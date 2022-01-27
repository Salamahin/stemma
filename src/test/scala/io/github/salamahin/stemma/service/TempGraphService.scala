package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.graph.{GRAPH, GraphService}
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.{PropertyType, SqlgGraph}
import zio.{Has, UIO, ULayer, ZIO, ZLayer, ZManaged}

import java.io.File
import java.util

case class TempGraphService(graph: UIO[ScalaGraph]) extends GraphService

object TempGraphService {
  private val tempFile = ZManaged
    .make(UIO(File.createTempFile("stemma", ".tmp")))(file => UIO(file.delete()))
    .toLayer

  val make: ULayer[GRAPH] = {
    val createGraph = (for {
      tempFile <- ZIO.environment[Has[File]].map(_.get)
      graph = {
        import gremlin.scala._
        val config = new BaseConfiguration {
          addPropertyDirect("jdbc.url", s"jdbc:h2:${tempFile.getPath};LOCK_TIMEOUT=3000")
          addPropertyDirect("jdbc.username", "SA")
          addPropertyDirect("jdbc.password", "")
        }

        val g: SqlgGraph = SqlgGraph.open(config)
//        val topology     = g.getTopology
//
//        val personVertexLabel = topology.ensureVertexLabelExist(
//          "public",
//          "person",
//          new util.HashMap[String, PropertyType]() {
//            {
//              put("name", PropertyType.STRING)
//              put("birthDate", PropertyType.STRING)
//              put("deathDate", PropertyType.STRING)
//            }
//          }
//        )
//
//        val familyVertexLabel = topology.ensureVertexLabelExist("public", "family", new util.HashMap[String, PropertyType]())
//
//        personVertexLabel.ensureEdgeLabelExist("spouseOf", familyVertexLabel, new util.HashMap[String, PropertyType]())
//        personVertexLabel.ensureEdgeLabelExist("childOf", familyVertexLabel, new util.HashMap[String, PropertyType]())
//
//        g.tx().commit()
        g.asScala()
      }
    } yield graph).provideLayer(tempFile)

    ZLayer.succeed(TempGraphService(createGraph))
  }
}
