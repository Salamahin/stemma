package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{InvalidInviteToken, User}
import zio.json.{DeriveJsonDecoder, DeriveJsonEncoder, JsonDecoder, JsonEncoder}
import zio.{Random, Task, URLayer, ZIO, ZLayer}

import java.security.MessageDigest
import java.util
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

case class InviteToken(inviteesEmail: String, targetPersonId: Long, entropy: String)

object InviteToken {
  implicit val decoder: JsonDecoder[InviteToken] = DeriveJsonDecoder.gen[InviteToken]
  implicit val encoder: JsonEncoder[InviteToken] = DeriveJsonEncoder.gen[InviteToken]
}

trait UserService {
  def createInviteToken(inviteeEmail: String, associatedPersonId: Long): Task[String]
  def decodeInviteToken(token: String): Task[InviteToken]
  def getOrCreateUser(email: String): Task[User]
}

object UserService {

  val live: URLayer[InviteSecrets with StorageService with Random, UserService] = ZLayer(for {
    storage <- ZIO.service[StorageService]
    secret  <- ZIO.service[InviteSecrets]
    rnd     <- ZIO.service[Random]
  } yield new UserService {
    import zio.json._

    override def createInviteToken(inviteeEmail: String, associatedPersonId: Long): Task[String] = {
      rnd.nextString(20).map { entropy =>
        val token = InviteToken(inviteeEmail, associatedPersonId, entropy)
        encrypt(secret.secretString, token.toJson)
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
        decrypted <- ZIO.attempt(decrypt(secret.secretString, token)).orElseFail(InvalidInviteToken())
        parsed    <- ZIO.fromEither(decrypted.fromJson[InviteToken]).orElseFail(InvalidInviteToken())
      } yield parsed

    private def decrypt(key: String, encryptedValue: String): String = {
      val cipher = Cipher.getInstance("AES/ECB/PKCS5PADDING")
      cipher.init(Cipher.DECRYPT_MODE, keyToSpec(key))

      new String(cipher.doFinal(Base64.getDecoder.decode(encryptedValue)))
    }

    override def getOrCreateUser(email: String) = storage.getOrCreateUser(email)
  })
}
