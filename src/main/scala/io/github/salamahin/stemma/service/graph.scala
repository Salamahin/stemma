package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig
import zio.{Has, Ref, ZLayer}

object graph {
  type Graph = Has[GraphService]

  trait GraphService {
    val graph: ScalaGraph
  }

//  val singleton: ZLayer[Any, Nothing, Graph] = ZLayer.fromEffect(Ref.make(GraphConfig.newGraph()))
}
