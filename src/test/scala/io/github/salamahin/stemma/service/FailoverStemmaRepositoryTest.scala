package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.service.repo.{REPO, Repository}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.tinkerpop.{StemmaOperations, StemmaRepository}
import zio.test._
import zio.{UIO, ZIO, ZLayer}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  class FailedToSetRelationOps extends StemmaOperations {
    override def setChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] = Left(UnknownError("failed to set child relation"))
  }

  private val repo: ZLayer[GRAPH, Nothing, REPO] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .map(graph =>
      new Repository {
        override val repo: UIO[StemmaRepository] = graph.graph.map(g => new StemmaRepository(g, new FailedToSetRelationOps))
      }
    )
    .toLayer

  private val service = ZIO
    .environment[STEMMA]
    .map(_.get)
    .provideCustomLayer(TempGraphService.make >>> repo >>> stemma.live)

  private val revertChangesOnFailure = testM("any change that modifies graph would be reverted on failure") {
    for {
      failingStemma <- service
      _             <- failingStemma.newFamily(family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      stemma        <- failingStemma.stemma()
    } yield assertTrue(stemma.people.isEmpty) && assertTrue(stemma.families.isEmpty)
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
