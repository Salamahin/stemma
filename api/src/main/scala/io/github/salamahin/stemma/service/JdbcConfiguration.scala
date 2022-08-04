package io.github.salamahin.stemma.service

import zio.{TaskLayer, ZIO, ZLayer}

trait JdbcConfiguration {
  val jdbcUrl: String
  val jdbcUser: String
  val jdbcPassword: String
}

object JdbcConfiguration {
  val fromEnv: TaskLayer[JdbcConfiguration] = {
    ZLayer(ZIO.attempt(new JdbcConfiguration {
      override val jdbcUrl: String      = sys.env.getOrElse("JDBC_URL", throw new IllegalStateException("JDBC_URL env var is missing"))
      override val jdbcUser: String     = sys.env.getOrElse("JDBC_USER", throw new IllegalStateException("JDBC_USER env var is missing"))
      override val jdbcPassword: String = sys.env.getOrElse("JDBC_PASSWORD", throw new IllegalStateException("JDBC_PASSWORD env var is missing"))
    }))
  }
}
