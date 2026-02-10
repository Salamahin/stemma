package io.github.salamahin.stemma.apis.restful

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import zio.{Task, URLayer, ZIO, ZLayer}

import java.util.Collections
import java.util.Locale

trait OAuthService {
  def decode(token: String): Task[String]
}

object OAuthService {
  val allowAnyToken: URLayer[Any, OAuthService] = ZLayer.succeed(
    new OAuthService {
      override def decode(token: String): Task[String] = {
        val normalized = token.trim.toLowerCase(Locale.ROOT)
        val email =
          if (normalized.contains("@")) normalized
          else s"e2e-${Integer.toHexString(normalized.hashCode)}@stemma.local"
        ZIO.succeed(email)
      }
    }
  )

  val googleSignIn: URLayer[GoogleSecrets, OAuthService] = ZLayer(
    ZIO
      .service[GoogleSecrets]
      .map(_.clientId)
      .map(secret =>
        new OAuthService {
          private val verifier = new GoogleIdTokenVerifier.Builder(GoogleNetHttpTransport.newTrustedTransport, GsonFactory.getDefaultInstance)
            .setAudience(Collections.singletonList(s"$secret.apps.googleusercontent.com"))
            .build()

          override def decode(token: String) = ZIO.attempt {
            verifier.verify(token).getPayload.getEmail
          }
        }
      )
  )
}
