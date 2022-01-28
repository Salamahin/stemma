package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.{Decoder, Encoder, parser}
import io.github.salamahin.stemma.domain.{InvalidInviteToken, StemmaError, User}
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.service.SecretService.SECRET
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import io.github.salamahin.stemma.tinkerpop.Transaction._
import zio.{Has, IO, UIO, URLayer, ZIO}

import java.security.MessageDigest
import java.util
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

object AuthService {
  trait AuthService {
    def createInviteToken(userEmail: String, personId: String): UIO[String]
    def invitationAccepted(userId: String, token: String): IO[StemmaError, User]
    def getOrCreateUser(email: String): UIO[User]
  }

  case class InviteToken(inviteesEmail: String, targetPersonId: String)
  object InviteToken {
    implicit val encoder: Encoder[InviteToken] = deriveEncoder[InviteToken]
    implicit val decoder: Decoder[InviteToken] = deriveDecoder[InviteToken]
  }

  private class LiveAuthService(secret: String, graph: ScalaGraph, ops: StemmaOperations) extends AuthService {
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

    override def createInviteToken(userEmail: String, personId: String): UIO[String] = UIO {
      import io.circe.syntax._

      val token = InviteToken(userEmail, personId)
      encrypt(secret, token.asJson.noSpaces)
    }

    private def decryptInviteToken(token: String) = IO.fromEither {
      import cats.syntax.bifunctor._
      parser
        .parse(decrypt(secret, token))
        .flatMap(_.as[InviteToken])
        .leftMap(_ => InvalidInviteToken())
    }

    override def invitationAccepted(bearerEmail: String, token: String): IO[StemmaError, User] =
      for {
        (u @ User(bearerId, _), InviteToken(inviteesEmail, targetPersonId)) <- getOrCreateUser(bearerEmail) zipPar decryptInviteToken(token)
        _                                                                   <- if (bearerId != inviteesEmail) UIO.succeed() else IO.fromEither(transaction(graph) { tx => ops.changeOwner(tx, bearerId, targetPersonId) })
      } yield u

    override def getOrCreateUser(email: String): UIO[User] = UIO(ops.getOrCreateUser(graph.traversal, email))
  }

  type AUTH = Has[AuthService]

  val live: URLayer[OPS with SECRET with GRAPH, AUTH] = (for {
    graph  <- ZIO.environment[GRAPH].map(_.get)
    secret <- ZIO.environment[SECRET].map(_.get)
    ops    <- ZIO.environment[OPS].map(_.get)
  } yield new LiveAuthService(secret.secret, graph.graph, ops)).toLayer
}
