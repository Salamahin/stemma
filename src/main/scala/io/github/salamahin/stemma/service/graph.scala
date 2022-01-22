package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Has, Ref, ULayer, ZRef}

object graph {
  trait GraphService {
    val graph: Ref[ScalaGraph]
  }

  type GRAPH = Has[GraphService]

  def newGraph: ULayer[GRAPH] =
    ZRef
      .make {
        import gremlin.scala._
        TinkerGraph.open(new GraphConfig).asScala()
      }
      .map { g =>
        new GraphService {
          override val graph: Ref[ScalaGraph] = g
        }
      }
      .toLayer
}
