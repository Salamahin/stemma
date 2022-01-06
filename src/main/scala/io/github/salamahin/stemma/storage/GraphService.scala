package io.github.salamahin.stemma.storage

import gremlin.scala.ScalaGraph
import zio.{Has, ZLayer}

trait GraphService {
  val graph: ScalaGraph
}

object GraphService {
  type Graph = Has[GraphService]

  val singleton: ZLayer[Any, Nothing, Graph] = ZLayer.succeed(new GraphService {
    override val graph: ScalaGraph = GraphConfig.newGraph()
  })
}
