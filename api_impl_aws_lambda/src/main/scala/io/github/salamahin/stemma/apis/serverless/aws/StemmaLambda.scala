package io.github.salamahin.stemma.apis.serverless.aws

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.serverless.aws.StemmaLambda.handler
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{ConfiguredStemmaService, InviteSecrets, StorageService, UserService}
import zio.Random.RandomLive
import zio.{IO, UIO, ZIO, ZLayer}

import java.nio.file.{Files, Paths}

class StemmaLambda extends LambdaRunner[Request, Response] {
  override def run(email: String, request: Request): IO[StemmaError, Response] = handler.flatMap(_.handle(email, request))
}

object StemmaLambda extends LazyLogging {
  private val ss =
    try {
      val rootCert = Paths.get("/tmp/cockroach-proud-gnoll.crt")

      if (!Files.exists(rootCert)) {
        Files.writeString(rootCert, sys.env("JDBC_CERT"))
      }

      new ConfiguredStemmaService()
    } catch {
      case exc: Throwable => logger.error("Fatal error while making stemma service", exc); throw exc
    }

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
    .tapError(err => ZIO.succeed(logger.error("Failed to create deps", err)))
    .orDie
}
