package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.service.{JdbcConfiguration, SlickStemmaService}
import zio.{Scope, ZIO, ZIOAppArgs, ZIOAppDefault}

object CreateSchemaRunner extends ZIOAppDefault {
  override def run: ZIO[Any with ZIOAppArgs with Scope, Any, Any] =
    ZIO
      .service[JdbcConfiguration]
      .flatMap { jdbc => ZIO.acquireRelease(ZIO.attempt(new SlickStemmaService(jdbc)).tap(_.createSchema))(x => ZIO.succeed(x.close())) }
      .provideSome(JdbcConfiguration.fromEnv)
}
