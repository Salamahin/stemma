package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import com.typesafe.config.{Config, ConfigFactory}
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain.{Request, RequestDeserializationProblem}
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import slick.interop.zio.DatabaseProvider
import slick.jdbc.{JdbcBackend, JdbcProfile, PostgresProfile}
import zio.Random.RandomLive
import zio.json.{DecoderOps, EncoderOps}
import zio.{Exit, Runtime, Scope, UIO, Unsafe, ZEnvironment, ZIO, ZLayer}

import java.nio.file.{Files, Paths}
import java.util.Base64
import scala.util.Try

class StemmaLambda extends LazyLogging {
  logger.debug("Hello world!")

  def apply(input: APIGatewayV2HTTPEvent, context: Context) = {
    val email = ZIO.succeed(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"))

    val request = ZIO
      .attempt(new String(Base64.getDecoder.decode(input.getBody)))
      .tap(body => ZIO.succeed(logger.debug(s"Received request body: $body")))
      .flatMap(str => ZIO.fromEither(str.fromJson[Request]))
      .mapError(err => RequestDeserializationProblem(s"Failed to deser the request, details: $err"))

    val handler = (for {
      service       <- ZIO.service[HandleApiRequestService]
      (email, body) <- email <&> request
      res           <- service.handle(email, body)
    } yield res)
      .tapError(err => ZIO.succeed(logger.error("Error occurred", err)))
      .fold(
        err => err.toJson,
        res => res.toJson
      )
      .tap(resp => ZIO.succeed(logger.debug(s"Generated response (truncated): ${resp.take(100)}")))

    Unsafe.unsafe { implicit u =>
      logger.debug("Unsafe run")
      StemmaLambda.runtime.unsafe.run(handler) match {
        case Exit.Success(successJson) => successJson
      }
    }
  }
}

object StemmaLambda extends LazyLogging {
  self =>
  private val conf     = ConfigFactory.load().getConfig("dbConfig")
  private val profile  = PostgresProfile
  private val database = profile.backend.Database.forConfig("", conf)

  private val databaseProvider = new DatabaseProvider {
    override def db: UIO[JdbcBackend#DatabaseDef] = ZIO.succeed(database)
    override def profile: UIO[JdbcProfile]        = ZIO.succeed(self.profile)
  }

  sys.addShutdownHook {
    database.close()
  }

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

  private val layers: ZLayer[Any, Nothing, HandleApiRequestService] = ZLayer.fromZIO(
    (createCerts *>
      ZIO
        .service[HandleApiRequestService]
        .provideSome[Scope](
          ZLayer.succeed(databaseProvider),
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

  val runtime = Unsafe.unsafe { implicit u => Runtime.unsafe.fromLayer(StemmaLambda.layers) }
}
