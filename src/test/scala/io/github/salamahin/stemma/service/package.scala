package io.github.salamahin.stemma

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.GraphService.{GRAPH, GraphService}
import io.github.salamahin.stemma.service.SecretService.Secret
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Has, UIO, ULayer, ZIO, ZLayer, ZManaged}

import java.io.File

package object service {
  val hardcodedSecret = ZLayer.succeed(new Secret {
    override val secret: String = "secret_string"
  })

  private val tempFile = ZManaged
    .make(UIO(File.createTempFile("stemma", ".tmp")))(file => UIO(file.delete()))
    .toLayer

  case class TempGraphService(graph: ScalaGraph) extends GraphService

  val tempGraph: ULayer[GRAPH] =
    (for {
      tempFile <- ZIO.environment[Has[File]].map(_.get)
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
    } yield TempGraphService(graph)).provideLayer(tempFile).toLayer
}
