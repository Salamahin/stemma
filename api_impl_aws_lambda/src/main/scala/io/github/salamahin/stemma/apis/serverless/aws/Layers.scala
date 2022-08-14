package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.domain.{StemmaError, UnknownError}
import io.github.salamahin.stemma.service._
import zio.Random.RandomLive
import zio.{ZIO, ZLayer}

object Layers {
  @volatile private var ss: SlickStemmaService = _
  sys.addShutdownHook(() => { if (ss != null) ss.close() })

  private val hookedGraphService: ZLayer[JdbcConfiguration, Throwable, SlickStemmaService] = ZLayer.fromZIO(
    ZIO
      .service[JdbcConfiguration]
      .map(conf => {
        ss = new SlickStemmaService(
          conf,
          Map(
            "connectionPool"      -> "HikariCP",
            "numThreads"          -> "5",
            "maxConnections"      -> "5",
            "keepAliveConnection" -> "true"
          )
        )
        ss
      })
  )

  val layers: ZLayer[Any, StemmaError, StorageService with UserService] =
    (ZLayer.succeed(RandomLive) >+>
      InviteSecrets.fromEnv >+>
      JdbcConfiguration.fromEnv >+>
      hookedGraphService >+>
      UserService.live).mapError(exc => UnknownError(exc))
}
