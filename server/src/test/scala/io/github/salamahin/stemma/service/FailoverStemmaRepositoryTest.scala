package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{ULayer, ZIO, ZLayer}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val failedToRemoveOps = ZLayer.succeed(new StemmaOperations {
    override def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = Left(NoSuchFamilyId(id))
  })

  private val layer: ULayer[GraphService with StemmaOperations with Secrets] = tempGraph ++ failedToRemoveOps ++ hardcodedSecret
  private val services = (ZIO.environment[StemmaService].map(_.get) zip ZIO.environment[UserService].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ UserService.live))

  private val revertChangesOnFailure = test("any change that modifies graph would be reverted on failure") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, jamesId :: _ :: Nil, Nil) <- s.createFamily(userId, graphId, family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      _                                   <- s.removePerson(userId, jamesId).catchAll(_ => ZIO.succeed())
      render(stemma)                      <- s.stemma(userId, graphId)
    } yield assert(stemma)(hasSameElements("(James, July) parentsOf ()" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
