package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.apis.HandleApiRequests
import io.github.salamahin.stemma.apis.serverless.aws.StemmaLambda.layers
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{ConfiguredStemmaService, InviteSecrets, StorageService, UserService}
import zio.Random.RandomLive
import zio.{ZIO, ZLayer}

class StemmaLambda extends LambdaRunner[Request, Response] with HandleApiRequests {
  override def run(email: String, request: Request): ZIO[Any, Throwable, Response] = handle(email, request).provideLayer(layers)
}

object StemmaLambda {
  private val ss = new ConfiguredStemmaService()
  sys.addShutdownHook(() => {
    if (ss != null) ss.close()
  })

  val layers: ZLayer[Any, Throwable, StorageService with UserService] =
    ZLayer.succeed(ss: StorageService) >+> ((InviteSecrets.fromEnv ++ ZLayer.succeed(RandomLive)) >>> UserService.live)
}
