package io.github.salamahin.stemma.service

import com.typesafe.scalalogging.LazyLogging
import gremlin.scala.ScalaGraph
import io.circe.parser
import io.github.salamahin.stemma.domain.{Email, InvalidInviteToken, InviteToken, User}
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import io.github.salamahin.stemma.tinkerpop.Transaction.transactionSafe
import zio.{IO, UIO, URLayer, ZIO, ZLayer}

import java.security.MessageDigest
import java.util
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

trait UserService {
  def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String]
  def decodeInviteToken(token: String): IO[InvalidInviteToken, InviteToken]
  def getOrCreateUser(email: Email): UIO[User]
}

object UserService extends LazyLogging {

  val live: URLayer[Secrets with GraphService, UserService] = ZLayer(for {
    graph  <- ZIO.environment[GraphService].map(_.get)
    secret <- ZIO.environment[Secrets].map(_.get)
  } yield new UserServiceImpl(secret.invitationSecret, graph.graph, new StemmaRepository))

  private class UserServiceImpl(secret: String, graph: ScalaGraph, ops: StemmaRepository) extends UserService {
    override def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String] = ZIO.succeed {
      import io.circe.syntax._

      val token = InviteToken(inviteeEmail, associatedPersonId)
      encrypt(secret, token.asJson.noSpaces)
    }

    private def encrypt(key: String, value: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5Padding")
      cipher.init(Cipher.ENCRYPT_MODE, keyToSpec(key))
      val bytes = cipher.doFinal(value.getBytes("UTF-8"))

      new String(Base64.getEncoder.encode(bytes))
    }

    private def keyToSpec(key: String): SecretKeySpec = {
      val sha    = MessageDigest.getInstance("SHA-1")
      val digest = sha.digest(key.getBytes("UTF-8"))

      val keySpec = util.Arrays.copyOf(digest, 16)
      new SecretKeySpec(keySpec, "AES")
    }

    override def decodeInviteToken(token: String) = ZIO.fromEither {
      import cats.syntax.bifunctor._
      parser
        .parse(decrypt(secret, token))
        .flatMap(_.as[InviteToken])
        .leftMap(_ => InvalidInviteToken())
    }

    private def decrypt(key: String, encryptedValue: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5PADDING")
      cipher.init(Cipher.DECRYPT_MODE, keyToSpec(key))

      new String(cipher.doFinal(Base64.getDecoder.decode(encryptedValue)))
    }

    override def getOrCreateUser(email: Email): UIO[User] = ZIO.succeed {
      logger.debug(s"Get or create a new user with email $email")
      transactionSafe(graph) { tx => ops.getOrCreateUser(tx, email) }
    }
  }
}
