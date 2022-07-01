package io.github.salamahin.stemma

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.{StemmaApi, WebApi}
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Clock, Console, RIO, Scope, ZIO, ZIOAppArgs, ZIOAppDefault}

object Main extends ZIOAppDefault with LazyLogging with WebApi with StemmaApi {

  type STEMMA_ENV     = OAuthService with UserService with StemmaService with Console with Clock
  type STEMMA_TASK[A] = RIO[STEMMA_ENV, A]

  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    Server
      .start(8090, stemmaApis @@ cors(corsConfig))
      .exitCode
      .provide(
        Secrets.envSecrets,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        OAuthService.googleSignIn
      )
  }
}
