package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.StemmaService.{STEMMA, StemmaService}
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{URLayer, ZIO}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  class FailedToRemoveFamilyOps extends StemmaOperations {
    override def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = Left(NoSuchFamilyId(id))
  }

  private val stemma: URLayer[GRAPH, STEMMA] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .flatMap(_.graph)
    .map(new StemmaService(_, new FailedToRemoveFamilyOps))
    .toLayer

  private val service = ZIO
    .environment[STEMMA]
    .map(_.get)
    .provideCustomLayer(TempGraph.make >>> stemma)

  private val revertChangesOnFailure = testM("any change that modifies graph would be reverted on failure") {
    for {
      s                                   <- service
      Family(_, jamesId :: _ :: Nil, Nil) <- s.createFamily(family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      _                                   <- s.removePerson(jamesId).catchAll(_ => ZIO.succeed())
      render(stemma)                      <- s.stemma()
    } yield assert(stemma)(hasSameElements("(James, July) parentsOf ()" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
