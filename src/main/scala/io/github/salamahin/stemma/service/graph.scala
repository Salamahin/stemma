package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Has, Ref, ULayer, ZRef}

object graph {
  trait Graph {
    val graph: Ref[ScalaGraph]
  }

  type GRAPH = Has[Graph]

  def newGraph: ULayer[Has[Graph]] = ZRef
    .make {
      import gremlin.scala._
      TinkerGraph.open(new GraphConfig).asScala()
    }
    .map { g =>
      new Graph {
        override val graph: Ref[ScalaGraph] = g
      }
    }
    .toLayer
}
