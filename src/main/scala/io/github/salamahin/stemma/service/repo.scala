package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.tinkerpop.{StemmaOperations, StemmaRepository}
import zio.{Has, UIO, URLayer, ZIO}

object repo {
  trait Repository {
    val repo: UIO[StemmaRepository]
  }

  type REPO = Has[Repository]

  val live: URLayer[GRAPH, REPO] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .map(graph =>
      new Repository {
        override val repo: UIO[StemmaRepository] = graph.graph.map(new StemmaRepository(_, new StemmaOperations))
      }
    )
    .toLayer
}
