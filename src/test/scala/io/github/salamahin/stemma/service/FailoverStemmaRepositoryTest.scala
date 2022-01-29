package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.AuthService.AUTH
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.service.SecretService.SECRET
import io.github.salamahin.stemma.service.StemmaService.STEMMA
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{ULayer, ZIO, ZLayer}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  val failedToRemoveOps = ZLayer.succeed(new StemmaOperations {
    override def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = Left(NoSuchFamilyId(id))
  })

  private val layer: ULayer[GRAPH with OPS with SECRET] = tempGraph ++ failedToRemoveOps ++ hardcodedSecret
  private val services = (ZIO.environment[STEMMA].map(_.get) zip ZIO.environment[AUTH].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ AuthService.live))


  private val revertChangesOnFailure = testM("any change that modifies graph would be reverted on failure") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, jamesId :: _ :: Nil, Nil) <- s.createFamily(graphId, userId, family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      _                                   <- s.removePerson(jamesId).catchAll(_ => ZIO.succeed())
      render(stemma)                      <- s.stemma(graphId)
    } yield assert(stemma)(hasSameElements("(James, July) parentsOf ()" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
