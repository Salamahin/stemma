package io.github.salamahin.stemma

import gremlin.scala.ScalaGraph
import zio.{ULayer, ZIO, ZLayer}

import java.io.File

package object service {
  val hardcodedSecret: ULayer[InviteSecrets] = ZLayer.succeed(new InviteSecrets {
    override val secretString: String = "secret_string"
  })

  case class TempGraphService(graph: ScalaGraph) extends GraphService

  val tempGraph =
    ZLayer.scoped(for {
      tempFile <- ZIO.acquireRelease(
                   ZIO.succeed(File.createTempFile("stemma", ".tmp"))
                 )(file => ZIO.succeed(file.delete()))

      graph = GraphService.configure(new JdbcConfiguration {
        override val jdbcUrl: String      = s"jdbc:h2:${tempFile.getPath};LOCK_TIMEOUT=3000"
        override val jdbcUser: String     = "SA"
        override val jdbcPassword: String = ""
      })

    } yield TempGraphService(graph))
}
