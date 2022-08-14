package io.github.salamahin.stemma.apis.serverless.aws

import ch.qos.logback.core.util.TimeUtil
import io.github.salamahin.stemma.domain.{StemmaError, UnknownError}
import io.github.salamahin.stemma.service._
import zio.Random.RandomLive
import zio.{Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

import java.util.concurrent.TimeUnit

object Layers {
  @volatile private var ss: SlickStemmaService = _
  sys.addShutdownHook(() => { if (ss != null) ss.close() })

  private val hookedGraphService: ZLayer[Any, Throwable, SlickStemmaService] = ZLayer.fromZIO(
    ZIO.attempt {
      ss = new ConfiguredStemmaService()
      ss
    }
  )

  val layers: ZLayer[Any, StemmaError, StorageService with UserService] =
    (ZLayer.succeed(RandomLive) >+>
      InviteSecrets.fromEnv >+>
      hookedGraphService >+>
      UserService.live).mapError(exc => UnknownError(exc))
}


object Aaaa extends ZIOAppDefault {
  override def run: ZIO[Any with ZIOAppArgs with Scope, Any, Any] = ZIO.succeed {
    new ConfiguredStemmaService
    TimeUnit.SECONDS.sleep(30)
  }
}