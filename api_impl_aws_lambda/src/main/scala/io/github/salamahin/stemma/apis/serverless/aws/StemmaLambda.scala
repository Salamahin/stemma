package io.github.salamahin.stemma.apis.serverless.aws

import com.typesafe.config.{Config, ConfigFactory}
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.serverless.aws.StemmaLambda.layers
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import slick.interop.zio.DatabaseProvider
import slick.jdbc._
import zio.Random.RandomLive
import zio.{IO, UIO, ZIO, ZLayer}

import java.nio.file.{Files, Paths}
import java.util.Base64
import scala.util.Try

class StemmaLambda extends LambdaRunner[Request, Response] {
  override def run(email: String, request: Request): IO[StemmaError, Response] =
    ZIO
      .service[HandleApiRequestService]
      .flatMap(_.handle(email, request))
      .provideSome(layers)
}

object StemmaLambda extends LazyLogging {
  private val createCerts = ZIO.fromTry {
    Try {
      val rootCert = Paths.get("/tmp/cockroach-proud-gnoll.crt")

      if (!Files.exists(rootCert)) {
        val decodedCert = new String(Base64.getDecoder.decode(sys.env("JDBC_CERT")))
        Files.writeString(rootCert, decodedCert)
        logger.info("Root cert created")
      }
    }
  }

  private val dbConfigLayer  = ZLayer(ZIO.attempt(ConfigFactory.load().getConfig("dbConfig")))
  private val dbBackendLayer = ZLayer.succeed(PostgresProfile)

  val layers: ZLayer[Any, Nothing, HandleApiRequestService] = ZLayer.fromZIO(
    (createCerts *> ZIO.service[HandleApiRequestService])
      .provideSome(
        (dbConfigLayer ++ dbBackendLayer) >>> DatabaseProvider.live,
        StorageService.live,
        InviteSecrets.fromEnv,
        ZLayer.succeed(RandomLive),
        UserService.live,
        ApiService.live,
        HandleApiRequestService.live
      )
      .tapError(err => ZIO.succeed(logger.error("Failed to create deps", err)))
      .orDie
  )
}
