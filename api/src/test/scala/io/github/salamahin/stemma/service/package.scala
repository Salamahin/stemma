package io.github.salamahin.stemma

import io.github.scottweaver.models.JdbcInfo
import io.github.scottweaver.zio.testcontainers.postgres.ZPostgreSQLContainer
import zio.{Scope, ULayer, ZIO, ZLayer}

package object service {
  val hardcodedSecret: ULayer[InviteSecrets] = ZLayer.succeed(new InviteSecrets {
    override val secretString: String = "secret_string"
  })

  private val jdbcInfo: ULayer[JdbcInfo] = ZPostgreSQLContainer.Settings.default >+> ZPostgreSQLContainer.live
  val testcontainersStorage: ZLayer[Scope, Throwable, StorageService] = jdbcInfo >>> ZLayer.fromZIO(
    for {
      pg <- ZIO.service[JdbcInfo]
      service <- ZIO.acquireRelease(
                  ZIO.attempt(new HardcodedStemmaService(pg.jdbcUrl, pg.username, pg.password)).tap(_.createSchema)
                )(x => ZIO.succeed(x.close()))
    } yield service
  )

  class HardcodedStemmaService(url: String, user: String, password: String) extends SlickStemmaService {
    import api._
    override val db: backend.DatabaseDef = Database.forURL(url, user, password)
  }
}
