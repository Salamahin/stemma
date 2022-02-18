package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.{Email, FamilyDescription, InviteToken}
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.test._
import zio.{ULayer, ZIO}

object UserServiceTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val layer: ULayer[GraphService with StemmaOperations with Secrets] = tempGraph ++ OpsService.live ++ hardcodedSecret
  private val services = (ZIO.environment[StemmaService].map(_.get) zip ZIO.environment[UserService].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ UserService.live))

  private val canCreateUser = test("can create or found a user") {
    for {
      (_, a)      <- services
      createdUser <- a.getOrCreateUser(Email("user@test.com"))
      foundUser   <- a.getOrCreateUser(Email("user@test.com"))
    } yield assertTrue(createdUser == foundUser)
  }

  private val canCreateAnInvitationLink = test("can create invite token") {
    for {
      (s, a)  <- services
      user1   <- a.getOrCreateUser(Email("user@test.com"))
      graphId <- s.createGraph(user1.userId, "my first graph")

      FamilyDescription(_, _, joshId :: _) <- s.createFamily(user1.userId, graphId, family(createJane, createJohn)(createJosh, createJill))

      token        <- a.createInviteToken("invitee@test.com", joshId)
      decodedToken <- a.decodeInviteToken(token)
    } yield assertTrue(decodedToken == InviteToken("invitee@test.com", joshId))
  }

  override def spec = suite("UserServiceTest")(
    canCreateUser,
    canCreateAnInvitationLink
  )
}
