package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.service._
import zio.Random.RandomLive
import zio.ZLayer

object Layers {
  private val ss = new ConfiguredStemmaService()
  sys.addShutdownHook(() => { if (ss != null) ss.close() })

  val layers: ZLayer[Any, Throwable, StorageService with UserService] =
    ZLayer.succeed(ss: StorageService) >+> ((InviteSecrets.fromEnv ++ ZLayer.succeed(RandomLive)) >>> UserService.live)
}
