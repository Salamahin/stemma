package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import zio.{Has, URLayer, ZIO, ZRef}

object repo {
  type REPO = Has[Repository]

  trait Repository {
    val repo: ZRef[Nothing, Nothing, _, StemmaRepository]
  }

  private case class RepositoryImpl(override val repo: ZRef[Nothing, Nothing, _, StemmaRepository]) extends Repository

  val repo: URLayer[GRAPH, REPO] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .map(_.graph)
    .map(x => x.map(new StemmaRepository(_)))
    .map(x => RepositoryImpl(x))
    .toLayer
}
