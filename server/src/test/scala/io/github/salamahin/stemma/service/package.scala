package io.github.salamahin.stemma

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{ULayer, ZIO, ZLayer}

import java.io.File

package object service {
  val hardcodedSecret: ULayer[Secrets] = ZLayer.succeed(new Secrets {
    override val invitationSecret: String = "secret_string"
    override val postgresSecret: String   = "secret_string"
  })

  case class TempGraphService(graph: ScalaGraph) extends GraphService

  val tempGraph =
    ZLayer.scoped(for {
      tempFile <- ZIO.acquireRelease(
                   ZIO.succeed(File.createTempFile("stemma", ".tmp"))
                 )(file => ZIO.succeed(file.delete()))

      graph = {
        import gremlin.scala._
        val config = new BaseConfiguration {
          addPropertyDirect("jdbc.url", s"jdbc:h2:${tempFile.getPath};LOCK_TIMEOUT=3000")
          addPropertyDirect("jdbc.username", "SA")
          addPropertyDirect("jdbc.password", "")
        }

        val g: SqlgGraph = SqlgGraph.open(config)
        g.asScala()
      }
    } yield TempGraphService(graph))
}
