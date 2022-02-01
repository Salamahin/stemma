package io.github.salamahin.stemma.service

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import io.github.salamahin.stemma.domain.{StemmaError, UnknownError}
import io.github.salamahin.stemma.service.SecretService.SECRET
import zio.{Has, IO, URLayer, ZIO}

import java.util.Collections

object OAuthService {
  trait OAuthService {
    def decode(token: String): IO[StemmaError, String]
  }

  type OAUTH = Has[OAuthService]

  val googleSignIn: URLayer[SECRET, OAUTH] = ZIO
    .environment[SECRET]
    .map(_.get)
    .map(_.googleApiSecret)
    .map(secret =>
      new OAuthService {
        private val verifier = new GoogleIdTokenVerifier.Builder(GoogleNetHttpTransport.newTrustedTransport, GsonFactory.getDefaultInstance)
          .setAudience(Collections.singletonList(s"$secret.apps.googleusercontent.com"))
          .build()

        override def decode(token: String) = IO.fromEither {
          try {
            val verified = verifier.verify(token)
            Right(verified.getPayload.getEmail)
          } catch {
            case ex: Throwable => Left(UnknownError(ex))
          }
        }
      }
    )
    .toLayer
}
