package io.github.salamahin.stemma.apis.restful

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain.{RequestDeserializationProblem, StemmaError, UnknownError, User, Request => DomainRequest}
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import org.apache.http.HttpResponse
import zhttp.http.Middleware.cors
import zhttp.http._
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Duration, Random, Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

object Main extends LazyLogging with ZIOAppDefault {
  import zio.json._

  private def httpResponse[R, T: JsonEncoder](effect: ZIO[R, StemmaError, T]) =
    effect
      .tapError(err => ZIO.succeed(logger.error(s"Service error: $err")))
      .fold(
        error => Response.json(error.toJson),
        result => Response.json(result.toJson)
      )

  private def stemmaApi(email: String) =
    Http.collectZIO[Request] {
      case req @ Method.POST -> !! / "stemma" =>
        httpResponse {
          req
            .bodyAsString
            .orDie
            .tap(body => ZIO.succeed(logger.debug(s"New request: $body")))
            .flatMap(body =>
              ZIO.fromEither {
                import cats.syntax.either._
                body
                  .fromJson[DomainRequest]
                  .leftMap(err => RequestDeserializationProblem(err)): Either[StemmaError, DomainRequest]
              }
            )
            .flatMap(req => ZIO.service[HandleApiRequestService].flatMap(_.handle(email, req).delay(Duration.fromSeconds(2))))
        }
    }

  private def authenticated[R](onSuccess: String => HttpApp[R, StemmaError]) =
    Http
      .fromFunctionZIO[Request] { request =>
        val getToken = ZIO
          .fromOption { request.headerValue(HeaderNames.authorization) }
          .map(_.replace("Bearer ", ""))

        for {
          userService <- ZIO.service[UserService]
          authService <- ZIO.service[OAuthService]

          token <- getToken.mapError(_ => HttpError.Unauthorized())
          email <- authService.decode(token).mapError(_ => HttpError.Unauthorized())
          user  <- userService.getOrCreateUser(email).mapError(err => HttpError.InternalServerError(cause = Some(err)))
        } yield user
      }
      .flatMap(u => onSuccess(u.userId).mapError(e => HttpError.InternalServerError(cause = Some(e))))
      .catchAll(err => Http.error(err))

  private val corsConfig = CorsConfig(anyOrigin = true)

  override def run: ZIO[ZIOAppArgs with Scope, Any, Any] = {
    val createSchema = ZIO
      .service[StorageService]
      .flatMap(_.createSchema)
      .catchAll(th => ZIO.succeed(logger.info("Failed to create schema", th)))

    (createSchema *> Server
      .start(8090, authenticated(stemmaApi) @@ cors(corsConfig))
      .tapError(err => ZIO.succeed(logger.error("Unexpected error", err))))
      .provideSome(
        ZLayer.succeed(Random.RandomLive),
        InviteSecrets.fromEnv,
        GoogleSecrets.fromEnv,
        OAuthService.googleSignIn,
        UserService.live,
        StorageService.slick,
        HandleApiRequestService.live,
        ApiService.live
      )
  }
}
