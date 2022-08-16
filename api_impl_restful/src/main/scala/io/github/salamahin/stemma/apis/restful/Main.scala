package io.github.salamahin.stemma.apis.restful

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.HandleApiRequests
import io.github.salamahin.stemma.domain.{StemmaError, UnknownError, Request => DomainRequest}
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import zhttp.http.Middleware.cors
import zhttp.http._
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Random, Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

object Main extends LazyLogging with HandleApiRequests with ZIOAppDefault {
  import zio.json._

  implicit class StemmaOperationSyntax[R, T: JsonEncoder](effect: ZIO[R, Throwable, T]) {
    def toResponse =
      effect
        .mapError(err => { logger.error(s"Service error: $err"); err })
        .mapBoth(
          error => HttpError.BadRequest((UnknownError(error): StemmaError).toJson),
          result => Response.json(result.toJson)
        )
  }

  private def stemmaApi(email: String) =
    Http.collectZIO[Request] {
      case req @ Method.POST -> !! / "stemma" =>
        req
          .bodyAsString
          .flatMap(body => ZIO.fromEither(body.fromJson[DomainRequest]).mapError(err => new IllegalArgumentException(err)))
          .flatMap(req => handle(email, req))
          .toResponse
    }

  def authenticated[R, E](onSuccess: String => HttpApp[R, E]): Http[R with UserService with OAuthService, E, Request, Response] =
    Http
      .fromFunctionZIO[Request] { request =>
        val parseToken = ZIO
          .fromOption {
            request.headerValue(HeaderNames.authorization)
          }
          .mapBoth(
            _ => HttpError.Forbidden(),
            _.replace("Bearer ", "")
          )

        val user = for {
          userService <- ZIO.service[UserService]
          authService <- ZIO.service[OAuthService]

          token <- parseToken
          email <- authService.decode(token).mapError(err => HttpError.InternalServerError(cause = Some(err)))
          user  <- userService.getOrCreateUser(email)
        } yield user

        user.fold(
          err => Http.error((UnknownError(err): StemmaError).toJson),
          user => onSuccess(user.email)
        )
      }
      .flatten

  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost"
  )

  override def run: ZIO[ZIOAppArgs with Scope, Any, Any] = {
    (for {
      storage <- ZIO.service[StorageService]
      _       <- storage.createSchema
      _       = logger.debug("Schema created")
      f       <- Server.start(8090, authenticated(stemmaApi) @@ cors(corsConfig)).exitCode.fork
      _       = logger.info("Server ready")
      _       <- f.join
    } yield ())
      .provideSome(
        ZLayer.succeed(Random.RandomLive),
        InviteSecrets.fromEnv,
        GoogleSecrets.fromEnv,
        OAuthService.googleSignIn,
        UserService.live,
        StorageService.slick
      )
  }
}
