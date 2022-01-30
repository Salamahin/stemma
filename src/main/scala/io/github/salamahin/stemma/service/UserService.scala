package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.circe.parser
import io.github.salamahin.stemma.domain.{InvalidInviteToken, InviteToken, User}
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.service.SecretService.SECRET
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.{Has, IO, UIO, URLayer, ZIO}

import java.security.MessageDigest
import java.util
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

object UserService {
  trait UserService {
    def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String]
    def decodeInviteToken(token: String): IO[InvalidInviteToken, InviteToken]
    def getOrCreateUser(email: String): UIO[User]
  }

  private class UserServiceImpl(secret: String, graph: ScalaGraph, ops: StemmaOperations) extends UserService {
    private def encrypt(key: String, value: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5Padding")
      cipher.init(Cipher.ENCRYPT_MODE, keyToSpec(key))
      val bytes = cipher.doFinal(value.getBytes("UTF-8"))

      new String(Base64.getEncoder.encode(bytes))
    }

    private def decrypt(key: String, encryptedValue: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5PADDING")
      cipher.init(Cipher.DECRYPT_MODE, keyToSpec(key))

      new String(cipher.doFinal(Base64.getDecoder.decode(encryptedValue)))
    }

    private def keyToSpec(key: String): SecretKeySpec = {
      val sha    = MessageDigest.getInstance("SHA-1")
      val digest = sha.digest(key.getBytes("UTF-8"))

      val keySpec = util.Arrays.copyOf(digest, 16)
      new SecretKeySpec(keySpec, "AES")
    }

    override def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String] = UIO {
      import io.circe.syntax._

      val token = InviteToken(inviteeEmail, associatedPersonId)
      encrypt(secret, token.asJson.noSpaces)
    }

    override def decodeInviteToken(token: String) = IO.fromEither {
      import cats.syntax.bifunctor._
      parser
        .parse(decrypt(secret, token))
        .flatMap(_.as[InviteToken])
        .leftMap(_ => InvalidInviteToken())
    }

    override def getOrCreateUser(email: String): UIO[User] = UIO(ops.getOrCreateUser(graph.traversal, email))
  }

  type USER = Has[UserService]

  val live: URLayer[OPS with SECRET with GRAPH, USER] = (for {
    graph  <- ZIO.environment[GRAPH].map(_.get)
    secret <- ZIO.environment[SECRET].map(_.get)
    ops    <- ZIO.environment[OPS].map(_.get)
  } yield new UserServiceImpl(secret.secret, graph.graph, ops)).toLayer
}
