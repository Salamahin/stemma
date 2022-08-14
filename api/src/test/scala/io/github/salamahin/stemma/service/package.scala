package io.github.salamahin.stemma

import io.github.scottweaver.models.JdbcInfo
import io.github.scottweaver.zio.testcontainers.postgres.ZPostgreSQLContainer
import zio.{Scope, ULayer, ZIO, ZLayer}

package object service {
  val hardcodedSecret: ULayer[InviteSecrets] = ZLayer.succeed(new InviteSecrets {
    override val secretString: String = "secret_string"
  })

  private val jdbcInfo: ULayer[JdbcInfo] = ZPostgreSQLContainer.Settings.default >+> ZPostgreSQLContainer.live
  val testcontainersStorage: ZLayer[Scope, Throwable, StorageService] = jdbcInfo >>> ZLayer.fromZIO(for {
    pg <- ZIO.service[JdbcInfo]

    jdbcConf = new JdbcConfiguration {
      override val jdbcUrl: String      = pg.jdbcUrl
      override val jdbcUser: String     = pg.username
      override val jdbcPassword: String = pg.password
    }

    service <- ZIO.acquireRelease(ZIO.attempt(new SlickStemmaService(jdbcConf)).tap(_.createSchema))(_.close())
  } yield service)
}
