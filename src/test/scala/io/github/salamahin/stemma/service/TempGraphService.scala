package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.graph.{GRAPH, GraphService}
import org.apache.commons.configuration2.BaseConfiguration
import org.apache.tinkerpop.gremlin.structure.{Graph => TinkerpopGraph}
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Has, Ref, UIO, ZIO, ZLayer, ZManaged}

import java.io.File

case class TempGraphService(graph: Ref[ScalaGraph]) extends GraphService

object TempGraphService {
  val tempFile = ZManaged
    .make(UIO(File.createTempFile("stemma", ".tmp")))(file => UIO(file.delete()))
    .toLayer

  val make: ZLayer[Any, Nothing, GRAPH] =
    ZIO
      .environment[Has[File]]
      .flatMap { f =>
        Ref.make {
          import gremlin.scala._
          val config = new BaseConfiguration {
            addPropertyDirect("jdbc.url", s"jdbc:h2:${f.get.getPath};DB_CLOSE_DELAY=0")
            addPropertyDirect("jdbc.username", "SA")
            addPropertyDirect("jdbc.password", "")
          }

          val g: TinkerpopGraph = SqlgGraph.open(config)

          g.asScala()
        }
      }
      .map(TempGraphService.apply)
      .provideLayer(tempFile)
      .toLayer
}
