package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.GraphService.{GRAPH, GraphService}
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{UIO, ULayer}

object TempGraph {
  case class TempGraphService(graph: ScalaGraph) extends GraphService

  val make: ULayer[GRAPH] = UIO {
    import gremlin.scala._

    val config = new BaseConfiguration {
      addPropertyDirect("jdbc.url", "jdbc:h2:mem:test")
      addPropertyDirect("jdbc.username", "SA")
      addPropertyDirect("jdbc.password", "")
    }

    val g: SqlgGraph = SqlgGraph.open(config)
    g.asScala()
  }.map(TempGraphService).toLayer
}
