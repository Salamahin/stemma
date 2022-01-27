package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.service.repo.{REPO, Repository}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.tinkerpop.{StemmaOperations, StemmaRepository}
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{UIO, ZIO, ZLayer}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  class FailedToRemoveChildRelation extends StemmaOperations {
    override def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = Left(NoSuchFamilyId(id))
  }

  private val repo: ZLayer[GRAPH, Nothing, REPO] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .map(graph =>
      new Repository {
        override val repo: UIO[StemmaRepository] = graph.graph.map(g => new StemmaRepository(g, new FailedToRemoveChildRelation))
      }
    )
    .toLayer

  private val service = ZIO
    .environment[STEMMA]
    .map(_.get)
    .provideCustomLayer(TempGraphService.make >>> repo >>> stemma.live)

  private val revertChangesOnFailure = testM("any change that modifies graph would be reverted on failure") {
    for {
      s                                   <- service
      Family(_, jamesId :: _ :: Nil, Nil) <- s.newFamily(family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      _                                   <- s.removePerson(jamesId).catchAll(_ => ZIO.succeed())
      render(stemma)                      <- s.stemma()
    } yield assert(stemma)(hasSameElements("(James, July) parentsOf ()" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
