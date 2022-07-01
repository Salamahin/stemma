package io.github.salamahin.stemma

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.{StemmaApi, OAuth}
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{ExitCode, Scope, ZIO, ZIOAppArgs, ZIOAppDefault}

object Main extends ZIOAppDefault with LazyLogging {
  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    Server
      .start(8090, OAuth.authenticate(StemmaApi.api) @@ cors(corsConfig))
      .exitCode
      .provide(
        Secrets.envSecrets,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        OAuthService.googleSignIn
      )
      .foldCause(
        failure => { logger.error(s"Unexpected failure:\n${failure.prettyPrint}"); ExitCode.failure },
        _ => { logger.info("bb gl hf"); ExitCode.success; }
      )
  }
}
