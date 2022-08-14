package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.FamilyDescription
import zio.test._
import zio.{Scope, ZIO}

object UserServiceTest extends ZIOSpecDefault with Requests with RenderStemma {
  private val userService: ZIO[StorageService, Nothing, UserService] =
    ZIO
      .service[UserService]
      .provideSome(hardcodedSecret, UserService.live, TestRandom.deterministic)

  private val canCreateUser = test("can create or found a user") {
    (for {
      us          <- userService
      createdUser <- us.getOrCreateUser("user@test.com")
      foundUser   <- us.getOrCreateUser("user@test.com")
    } yield assertTrue(createdUser == foundUser))
      .provideSome(Scope.default, testcontainersStorage)
  }

  private val canCreateAnInvitationLink = test("can create invite token") {
    (for {
      us       <- userService
      ss       <- ZIO.service[StorageService]
      user1    <- us.getOrCreateUser("user@test.com")
      stemmaId <- ss.createStemma(user1.userId, "my first stemma")

      FamilyDescription(_, _, joshId :: _, _) <- ss.createFamily(user1.userId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      token        <- us.createInviteToken("invitee@test.com", joshId)
      decodedToken <- us.decodeInviteToken(token)
    } yield assertTrue(decodedToken.inviteesEmail == "invitee@test.com") && assertTrue(decodedToken.targetPersonId == joshId))
      .provideSome(Scope.default, testcontainersStorage)
  }

  override def spec = suite("UserServiceTest")(
    canCreateUser,
    canCreateAnInvitationLink
  )
}
