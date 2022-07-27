package io.github.salamahin.stemma.apis.rest

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Random, Scope, ZEnvironment, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

object Runner extends ZIOAppDefault with LazyLogging {
  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    (Server.start(8090, RestApi.api @@ cors(corsConfig)) <&> ZIO.succeed(logger.info("Hello stemma")))
      .exitCode
      .provide(
        ZLayer.succeed(Random.RandomLive),
        Secrets.envSecrets,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        OAuthService.googleSignIn,
        Scope.default
      )
  }
}
