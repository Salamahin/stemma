package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.Family
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.service.SecretService.SECRET
import io.github.salamahin.stemma.service.StemmaService.STEMMA
import io.github.salamahin.stemma.service.UserService.USER
import zio.test._
import zio.{ULayer, ZIO}

object UserServiceTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val layer: ULayer[GRAPH with OPS with SECRET] = tempGraph ++ OpsService.live ++ hardcodedSecret
  private val services = (ZIO.environment[STEMMA].map(_.get) zip ZIO.environment[USER].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ UserService.live))

  private val canCreateUser = testM("can create or found a user") {
    for {
      (_, a)      <- services
      createdUser <- a.getOrCreateUser("user@test.com")
      foundUser   <- a.getOrCreateUser("user@test.com")
    } yield assertTrue(createdUser == foundUser)
  }

  private val canCreateAnInvitationLink = testM("when user accepts invitation ownship of his families is changed") {
    for {
      (s, a)  <- services
      user1   <- a.getOrCreateUser("user@test.com")
      graphId <- s.createGraph(user1.userId, "my first graph")

      Family(f1, janeId :: johnId :: Nil, joshId :: jillId :: Nil) <- s.createFamily(user1.userId, graphId, family(createJane, createJohn)(createJosh, createJill))
      Family(f2, _ :: jakeId :: Nil, julyId :: Nil)                <- s.createFamily(user1.userId, graphId, family(existing(jillId), createJake)(createJuly))

    } yield assertTrue(???)
  }

  override def spec = suite("UserServiceTest")(
    canCreateUser,
    canCreateAnInvitationLink
  )
}
