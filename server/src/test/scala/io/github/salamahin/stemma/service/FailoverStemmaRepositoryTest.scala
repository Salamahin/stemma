package io.github.salamahin.stemma.service

import gremlin.scala.TraversalSource
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{ZIO, ZLayer}

object FailoverStemmaRepositoryTest extends ZIOSpecDefault with Requests with RenderStemma {
  private val failedToRemoveRepo = new StemmaRepository {
    override def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = Left(NoSuchFamilyId(id))
  }

  private val stemmaService = ZLayer(ZIO.service[GraphService].map(g => new StemmaService(g.graph, failedToRemoveRepo)))

  private val services = (ZIO.service[StemmaService] zip ZIO.service[UserService])
    .provide(tempGraph, hardcodedSecret, stemmaService, UserService.live, TestRandom.deterministic)

  private val revertChangesOnFailure = test("any change that modifies stemma would be reverted on failure") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _ :: Nil, Nil, _) <- s.createFamily(userId, stemmaId, family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      _                                                 <- s.removePerson(userId, jamesId).catchAll(_ => ZIO.succeed())
      render(stemma)                                    <- s.stemma(userId, stemmaId)
    } yield assert(stemma)(hasSameElements("(James, July) parentsOf ()" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
