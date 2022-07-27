package io.github.salamahin.stemma.service

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import io.github.salamahin.stemma.domain.UnknownError
import zio.{IO, URLayer, ZIO, ZLayer}

import java.util.Collections

trait OAuthService {
  def decodeEmail(token: String): IO[UnknownError, String]
}

object OAuthService {
  val googleSignIn: URLayer[Secrets, OAuthService] = ZLayer(
    ZIO
      .service[Secrets]
      .map(_.googleApiSecret)
      .map(secret =>
        new OAuthService {
          private val verifier = new GoogleIdTokenVerifier.Builder(GoogleNetHttpTransport.newTrustedTransport, GsonFactory.getDefaultInstance)
            .setAudience(Collections.singletonList(s"$secret.apps.googleusercontent.com"))
            .build()

          override def decodeEmail(token: String) = ZIO.fromEither {
            try {
              val verified = verifier.verify(token)
              Right(verified.getPayload.getEmail)
            } catch {
              case ex: Throwable => Left(UnknownError(ex))
            }
          }
        }
      )
  )
}
