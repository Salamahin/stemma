package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig
import zio.{Has, ZLayer}

object graph {
  type Graph = Has[GraphService]

  trait GraphService {
    val graph: ScalaGraph
  }

  val singleton: ZLayer[Any, Nothing, Graph] = ZLayer.succeed(new GraphService {
    override val graph: ScalaGraph = GraphConfig.newGraph()
  })
}
