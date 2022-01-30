package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.{Family, InviteToken}
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

  private val canCreateAnInvitationLink = testM("can create invite token") {
    for {
      (s, a)  <- services
      user1   <- a.getOrCreateUser("user@test.com")
      graphId <- s.createGraph(user1.userId, "my first graph")

      Family(_, _, joshId :: _) <- s.createFamily(user1.userId, graphId, family(createJane, createJohn)(createJosh, createJill))

      token        <- a.createInviteToken("invitee@test.com", joshId)
      decodedToken <- a.decodeInviteToken(token)
    } yield assertTrue(decodedToken == InviteToken("invitee@test.com", joshId))
  }

  override def spec = suite("UserServiceTest")(
    canCreateUser,
    canCreateAnInvitationLink
  )
}
