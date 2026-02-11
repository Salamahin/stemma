package io.github.salamahin.stemma

import com.typesafe.config.ConfigFactory
import io.github.scottweaver.models.JdbcInfo
import io.github.scottweaver.zio.testcontainers.postgres.ZPostgreSQLContainer
import slick.interop.zio.DatabaseProvider
import slick.jdbc.PostgresProfile
import zio.{Scope, ULayer, ZIO, ZLayer}

import java.util.{Map => JMap}

package object service {
  private val dbBackendLayer = ZLayer.succeed(PostgresProfile)
  private val containerLayer = ZPostgreSQLContainer.Settings.default >+> ZPostgreSQLContainer.live

  private val migratedDbConfigLayer = containerLayer >>> ZLayer.fromZIO(
    for {
      info <- ZIO.service[JdbcInfo]
      _    <- ZIO.attempt(MigrationRunner.migrate(info.jdbcUrl, info.username, info.password))
    } yield ConfigFactory.parseMap(
      JMap.of(
        "jdbcUrl",
        info.jdbcUrl,
        "username",
        info.username,
        "password",
        info.password
      )
    )
  )

  val hardcodedSecret = ZLayer.succeed(new InviteSecrets {
    override val secretString: String = "secret_string"
  })

  val databaseProvider = (migratedDbConfigLayer ++ dbBackendLayer) >>> DatabaseProvider.live >>> StorageService.live
}
