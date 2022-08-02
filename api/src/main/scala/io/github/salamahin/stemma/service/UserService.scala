package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.domain.{InvalidInviteToken, InviteToken, User}
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import io.github.salamahin.stemma.tinkerpop.Transaction.transactionSafe
import zio.{IO, Random, UIO, URLayer, ZIO, ZLayer}

import java.security.MessageDigest
import java.util
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

trait UserService {
  def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String]
  def decodeInviteToken(token: String): IO[InvalidInviteToken, InviteToken]
  def getOrCreateUser(email: String): UIO[User]
}

object UserService {

  val live: URLayer[Secrets with GraphService with Random, UserService] = ZLayer(for {
    graph  <- ZIO.service[GraphService]
    secret <- ZIO.service[Secrets]
    rnd    <- ZIO.service[Random]
  } yield new UserServiceImpl(secret.invitationSecret, graph.graph, new StemmaRepository, rnd))

  private class UserServiceImpl(secret: String, graph: ScalaGraph, ops: StemmaRepository, rnd: Random) extends UserService {
    import zio.json._

    override def createInviteToken(inviteeEmail: String, associatedPersonId: String): UIO[String] = {
      rnd.nextString(20).map { entropy =>
        val token = InviteToken(inviteeEmail, associatedPersonId, entropy)
        encrypt(secret, token.toJson)
      }
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

    override def decodeInviteToken(token: String) =
      for {
        decrypted <- ZIO.attempt(decrypt(secret, token)).orElseFail(InvalidInviteToken())
        parsed    <- ZIO.fromEither(decrypted.fromJson[InviteToken]).orElseFail(InvalidInviteToken())
      } yield parsed

    private def decrypt(key: String, encryptedValue: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5PADDING")
      cipher.init(Cipher.DECRYPT_MODE, keyToSpec(key))

      new String(cipher.doFinal(Base64.getDecoder.decode(encryptedValue)))
    }

    override def getOrCreateUser(email: String): UIO[User] = ZIO.succeed {
      transactionSafe(graph) { tx => ops.getOrCreateUser(tx, email) }
    }
  }
}
