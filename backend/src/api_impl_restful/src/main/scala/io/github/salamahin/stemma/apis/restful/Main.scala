package io.github.salamahin.stemma.apis.restful

import com.typesafe.config.ConfigFactory
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain.{RequestDeserializationProblem, StemmaError, UnknownError, User, Request => DomainRequest}
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import org.apache.http.HttpResponse
import slick.interop.zio.DatabaseProvider
import slick.jdbc.PostgresProfile
import zhttp.http.Middleware.cors
import zhttp.http._
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Duration, Random, Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

object Main extends LazyLogging with ZIOAppDefault {
  import zio.json._
  private val e2eAuthBypassEnabled = sys.env.get("E2E_AUTH_BYPASS").contains("1")

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
            .flatMap(req => ZIO.serviceWithZIO[HandleApiRequestService](_.handle(email, req)).delay(Duration.fromSeconds(2)))
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
          _  <- userService.getOrCreateUser(email).mapError(err => HttpError.InternalServerError(cause = Some(err)))
        } yield email
      }
      .flatMap(email => onSuccess(email).mapError(e => HttpError.InternalServerError(cause = Some(e))))
      .catchAll(err => Http.error(err))

  private val corsConfig = CorsConfig(anyOrigin = true)

  override def run: ZIO[ZIOAppArgs with Scope, Any, Any] = {
    val rootConfig     = ConfigFactory.load()
    val dbConfigLayer  = ZLayer(ZIO.attempt(rootConfig.getConfig("dbConfig")))
    val dbBackendLayer = ZLayer.succeed(PostgresProfile)
    val authLayer      = if (e2eAuthBypassEnabled) OAuthService.allowAnyToken else (GoogleSecrets.fromEnv >>> OAuthService.googleSignIn)

    val createSchema = ZIO
      .service[StorageService]
      .flatMap(_.createSchema)
      .catchAll(th => ZIO.succeed(logger.info("Failed to create schema", th)))

    (createSchema *> Server
      .start(8090, authenticated(stemmaApi) @@ cors(corsConfig))
      .tapError(err => ZIO.succeed(logger.error("Unexpected error", err))))
      .provide(
        ZLayer.succeed(Random.RandomLive),
        (dbConfigLayer ++ dbBackendLayer) >>> DatabaseProvider.live,
        InviteSecrets.fromEnv,
        authLayer,
        UserService.live,
        StorageService.live,
        HandleApiRequestService.live,
        ApiService.live
      )
  }
}
