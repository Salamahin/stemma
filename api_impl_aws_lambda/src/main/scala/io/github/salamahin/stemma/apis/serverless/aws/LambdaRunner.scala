package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import com.typesafe.config.ConfigFactory
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.serverless.aws.LambdaRunner.lambdaRuntime
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain.{Request, RequestDeserializationProblem, Response, StemmaError}
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import slick.interop.zio.DatabaseProvider
import slick.jdbc.PostgresProfile
import zio.Random.RandomLive
import zio.json.{DecoderOps, EncoderOps, JsonDecoder, JsonEncoder}
import zio.{Exit, IO, Runtime, Unsafe, ZIO, ZLayer}

import java.nio.file.{Files, Paths}
import java.util.Base64
import scala.util.Try

class StemmaLambda extends LambdaRunner[Request, Response] {
  override def run(email: String, request: Request): ZIO[HandleApiRequestService, StemmaError, Response] =
    ZIO
      .service[HandleApiRequestService]
      .flatMap(_.handle(email, request))
}

abstract class LambdaRunner[In, Out](implicit jsonDecoder: JsonDecoder[In], jsonEncoder: JsonEncoder[Out]) extends LazyLogging {
  def run(email: String, request: In): ZIO[HandleApiRequestService, StemmaError, Out]

  final def apply(input: APIGatewayV2HTTPEvent, context: Context) = {
    logger.debug("Hello world!")

    val email = ZIO.succeed(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"))

    val request = ZIO
      .attempt(new String(Base64.getDecoder.decode(input.getBody)))
      .tap(body => ZIO.succeed(logger.debug(s"Received request body: $body")))
      .flatMap(str => ZIO.fromEither(str.fromJson[In]))
      .mapError(err => RequestDeserializationProblem(s"Failed to deser the request, details: $err"))

    val handle = (for {
      (email, body) <- email <&> request
      res           <- run(email, body)
    } yield res)
      .tapError(err => ZIO.succeed(logger.error("Error occurred", err)))
      .fold(
        err => err.toJson,
        res => res.toJson
      )
      .tap(resp => ZIO.succeed(logger.debug(s"Generated response (truncated): ${resp.take(100)}")))

    Unsafe.unsafe { implicit u =>
      logger.debug("Unsafe run")
      lambdaRuntime.unsafe.run(handle) match {
        case Exit.Success(successJson) => successJson
      }
    }
  }
}

object LambdaRunner extends LazyLogging {
  private val createCerts = ZIO.fromTry {
    Try {
      val rootCert = Paths.get("/tmp/cockroach-proud-gnoll.crt")

      if (!Files.exists(rootCert)) {
        val decodedCert = new String(Base64.getDecoder.decode(sys.env("JDBC_CERT")))
        Files.writeString(rootCert, decodedCert)
        logger.info("Root cert created")
      } else {
        logger.info("Root cert already exist")
      }
    }
  }

  private val dbConfigLayer  = ZLayer(ZIO.attempt(ConfigFactory.load().getConfig("dbConfig")))
  private val dbBackendLayer = ZLayer.succeed(PostgresProfile)

  private val layers = ZLayer.fromZIO(
    (createCerts *>
      ZIO
        .service[HandleApiRequestService]
        .provideSome(
          dbConfigLayer,
          dbBackendLayer,
          DatabaseProvider.live,
          StorageService.live,
          InviteSecrets.fromEnv,
          ZLayer.succeed(RandomLive),
          UserService.live,
          ApiService.live,
          HandleApiRequestService.live
        ))
      .tapError(err => ZIO.succeed(logger.error("Failed to create deps", err)))
      .orDie
  )

  val lambdaRuntime = Unsafe.unsafe { implicit unsafe => Runtime.unsafe.fromLayer(layers) }
  logger.debug("Runtime created")
}
