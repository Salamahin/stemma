package io.github.salamahin.stemma.migration

import com.amazonaws.services.lambda.runtime.Context
import io.github.salamahin.stemma.service.MigrationRunner

import java.nio.file.{Files, Paths}
import java.util.Base64

class MigrationLambda {
  private val rootCert = Paths.get("/tmp/cockroach-proud-gnoll.crt")
  if (!Files.exists(rootCert)) {
    val decodedCert = new String(Base64.getDecoder.decode(sys.env("JDBC_CERT")))
    Files.writeString(rootCert, decodedCert)
  }

  def apply(input: java.util.Map[String, Object], context: Context): String = {
    try {
      val jdbcUrl  = sys.env("JDBC_URL")
      val jdbcUser = sys.env("JDBC_USER")
      val jdbcPass = sys.env("JDBC_PASSWORD")
      MigrationRunner.migrate(jdbcUrl, jdbcUser, jdbcPass)
      "Migration completed successfully"
    } catch {
      case e: Exception =>
        val msg = s"Migration failed: ${e.getMessage}"
        context.getLogger.log(msg)
        throw e
    }
  }
}
