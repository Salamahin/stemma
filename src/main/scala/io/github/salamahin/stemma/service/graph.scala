package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import zio.{Has, Ref, UIO, ULayer, ZRef}

object graph {
  trait GraphService {
    val graph: UIO[ScalaGraph]
  }

  type GRAPH = Has[GraphService]

  def newGraph: ULayer[GRAPH] = ???
//    ZRef
//      .make {
//        import gremlin.scala._
//        TinkerGraph.open().asScala()
//      }
//      .map { g =>
//        new GraphService {
//          override val graph: Ref[ScalaGraph] = g
//        }
//      }
//      .toLayer
}
