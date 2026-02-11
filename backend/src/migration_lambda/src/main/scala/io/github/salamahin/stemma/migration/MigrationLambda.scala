package io.github.salamahin.stemma.migration

import com.amazonaws.services.lambda.runtime.Context
import com.typesafe.config.ConfigFactory
import io.github.salamahin.stemma.service.StorageService
import slick.interop.zio.DatabaseProvider
import slick.jdbc.{JdbcBackend, JdbcProfile, PostgresProfile}
import zio.{Exit, Runtime, UIO, Unsafe, ZIO, ZLayer}

import java.nio.file.{Files, Paths}
import java.util.Base64

class MigrationLambda {
  private val runtime = Unsafe.unsafe { implicit u => Runtime.unsafe.fromLayer(MigrationLambda.layers) }

  def apply(input: java.util.Map[String, Object], context: Context): String = {
    Unsafe.unsafe { implicit u =>
      runtime.unsafe.run(
        ZIO.service[StorageService].flatMap(_.createSchema)
      ) match {
        case Exit.Success(_) => "Migration completed successfully"
        case Exit.Failure(cause) => throw cause.squash
      }
    }
  }
}

object MigrationLambda {
  private val rootCert = Paths.get("/tmp/cockroach-proud-gnoll.crt")
  if (!Files.exists(rootCert)) {
    val decodedCert = new String(Base64.getDecoder.decode(sys.env("JDBC_CERT")))
    Files.writeString(rootCert, decodedCert)
  }

  private val conf    = ConfigFactory.load().getConfig("dbConfig")
  private val profile = PostgresProfile

  private lazy val database: JdbcBackend#DatabaseDef =
    profile.backend.Database.forConfig("", conf)

  private val databaseProvider = new DatabaseProvider {
    override def db: UIO[JdbcBackend#DatabaseDef] = ZIO.succeed(database)
    override def profile: UIO[JdbcProfile]        = ZIO.succeed(MigrationLambda.profile)
  }

  val layers: ZLayer[Any, Nothing, StorageService] =
    ZLayer.succeed(databaseProvider) >>> StorageService.live
}
