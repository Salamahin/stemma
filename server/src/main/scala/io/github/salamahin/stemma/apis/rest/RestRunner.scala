package io.github.salamahin.stemma.apis.rest

import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{ExitCode, Random, Scope, ZIO, ZIOAppArgs, ZIOAppDefault}

object RestRunner extends ZIOAppDefault  {
  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    Server
      .start(8090, OAuth.authenticate(StemmaApi.api) @@ cors(corsConfig))
      .exitCode
      .provide(
        Random.live,
        Secrets.envSecrets,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        OAuthService.googleSignIn,
        Scope.default
      )
//      .foldCause(
//        failure => { logger.error(s"Unexpected failure:\n${failure.prettyPrint}"); ExitCode.failure },
//        _ => { logger.info("bb gl hf"); ExitCode.success; }
//      )
  }
}
