package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Ref, ULayer, ZRef}

object graph {
  trait GraphService {
    val graph: Ref.Synchronized[ScalaGraph]
  }


  def newGraph: ULayer[GraphService] = ZRef.Synchronized
    .make {
      import gremlin.scala._
      TinkerGraph.open(new GraphConfig).asScala()
    }
    .map { g =>
      new GraphService {
        override val graph: Ref.Synchronized[ScalaGraph] = g
      }
    }
    .toLayer
}
