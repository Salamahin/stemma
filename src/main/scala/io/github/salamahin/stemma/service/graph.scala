package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Has, ZLayer}

object graph {
  trait Graph {
    val graph: ScalaGraph
  }

  type GRAPH = Has[Graph]

  val live: ZLayer[Any, Nothing, GRAPH] = ZLayer.succeed(new Graph {
    import gremlin.scala._
    override val graph: ScalaGraph = TinkerGraph.open(new GraphConfig).asScala()
  })
}
