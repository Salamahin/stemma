package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.apis.serverless.aws.StemmaLambda.handler
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{ConfiguredStemmaService, InviteSecrets, StorageService, UserService}
import zio.Random.RandomLive
import zio.{IO, UIO, ZIO, ZLayer}

class StemmaLambda extends LambdaRunner[Request, Response] {
  override def run(email: String, request: Request): IO[StemmaError, Response] = handler.flatMap(_.handle(email, request))
}

object StemmaLambda {
  private val ss = new ConfiguredStemmaService()

  sys.addShutdownHook(() => {
    if (ss != null) ss.close()
  })

  val handler: UIO[HandleApiRequestService] = ZIO
    .service[HandleApiRequestService]
    .provideSome(
      ZLayer.succeed(ss: StorageService),
      InviteSecrets.fromEnv,
      ZLayer.succeed(RandomLive),
      UserService.live,
      ApiService.live,
      HandleApiRequestService.live
    )
    .orDie
}
