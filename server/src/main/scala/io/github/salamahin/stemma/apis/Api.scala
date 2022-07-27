package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{OAuthService, StemmaService, UserService}
import zio.ZIO
import zio.logging.LogAnnotation

import java.util.UUID

case class ListStemmasRequest(bearerToken: String)
case class BearInvitationRequest(bearerToken: String, encodedToken: String)
case class DeleteStemmaRequest(bearerToken: String, stemmaId: String)
case class CreateNewStemmaRequest(bearerToken: String, stemmaName: String)
case class GetStemmaRequest(bearerToken: String, stemmaId: String)
case class DeletePersonRequest(bearerToken: String, stemmaId: String, personId: String)
case class UpdatePersonRequest(bearerToken: String, stemmaId: String, personId: String, personDescr: CreateNewPerson)
case class CreateInvitationTokenRequest(bearerToken: String, targetPersonId: String, targetPersonEmail: String)
case class CreateFamilyRequest(bearerToken: String, stemmaId: String, familyDescr: CreateFamily)
case class DeleteFamilyRequest(bearerToken: String, stemmaId: String, familyId: String)
case class UpdateFamilyRequest(bearerToken: String, stemmaId: String, familyId: String, familyDescr: CreateFamily)

object Api {
  private val userLogAnnotation = LogAnnotation[User]("user", (_, i) => i, _.userId)

  private def traced[R, T](f: UUID => ZIO[R, StemmaError, T]) =
    ZIO.succeed(UUID.randomUUID()).flatMap(traceId => f(traceId).mapError(err => TracedStemmaError(traceId, err)))

  private def user(bearerToken: String)(traceId: UUID): ZIO[UserService with OAuthService, UnknownError, User] =
    for {
      oauth <- ZIO.service[OAuthService]
      us    <- ZIO.service[UserService]

      _     <- ZIO.logInfo(s"Decoding token ${bearerToken.take(5)}*****") @@ LogAnnotation.TraceId(traceId)
      email <- oauth.decodeEmail(bearerToken)
      u     <- us.getOrCreateUser(email)
      _     <- ZIO.logInfo(s"User was associated with $u") @@ LogAnnotation.TraceId(traceId)
    } yield u

  def listStemmas(request: ListStemmasRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, OwnedStemmasDescription] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _       <- ZIO.logInfo(s"Requested list of owned stemmas") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      stemmas <- s.listOwnedStemmas(user.userId)
      _       <- ZIO.logInfo(s"Onwed stemmas: ${stemmas.stemmas}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemmas
  }

  def bearInvitation(request: BearInvitationRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Unit] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      us   <- ZIO.service[UserService]
      user <- user(request.bearerToken)(traceId)

      _     <- ZIO.logInfo(s"Bears invitation token ${request.encodedToken}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      token <- us.decodeInviteToken(request.encodedToken)
      _     <- ZIO.logInfo(s"Token was successfully decoded, target person is ${token.targetPersonId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)

      _ <- if (token.inviteesEmail == user.email) ZIO.succeed((): Unit)
          else ZIO.fail(ForeignInviteToken()) <* (ZIO.logError(s"User beared a foreign token") @@ userLogAnnotation(user)) @@ LogAnnotation.TraceId(traceId)

      result <- s.chown(user.userId, token.targetPersonId)

      _ <- ZIO.logInfo(s"Chown is complete, effected nodes $result") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield ()
  }

  def deleteStemma(request: DeleteStemmaRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, OwnedStemmasDescription] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _       <- ZIO.logInfo(s"Attempts to remove a stemma with id ${request.stemmaId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      _       <- s.removeStemma(user.userId, request.stemmaId)
      stemmas <- s.listOwnedStemmas(user.userId)
      _       <- ZIO.logInfo(s"Stemma removal succeed, onwed stemmas are $stemmas") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemmas
  }

  def createNewStemma(request: CreateNewStemmaRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, StemmaDescription] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _        <- ZIO.logInfo(s"Creates a new stemma with name ${request.stemmaName}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      stemmaId <- s.createStemma(user.userId, request.stemmaName)
      _        <- ZIO.logInfo(s"New stemma with id $stemmaId created") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield StemmaDescription(stemmaId, request.stemmaName, removable = true)
  }

  def stemma(request: GetStemmaRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _      <- ZIO.logInfo(s"Asks for stemma data with stemma id ${request.stemmaId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      <- ZIO.logInfo(s"Stemma has ${stemma.people.size} people and ${stemma.families.size} families total") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemma
  }

  def deletePerson(request: DeletePersonRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _      <- ZIO.logInfo(s"Deletes person with id ${request.personId} in stemma ${request.stemmaId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      _      <- s.removePerson(user.userId, request.personId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      <- ZIO.logInfo(s"Person removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemma
  }

  def updatePerson(request: UpdatePersonRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _      <- ZIO.logInfo(s"Updates person with id ${request.personId} in stemma ${request.stemmaId} with ${request.personDescr}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      _      <- s.updatePerson(user.userId, request.personId, request.personDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      <- ZIO.logInfo(s"Person updated") @@ userLogAnnotation(user)
    } yield stemma
  }

  def createInvitationToken(request: CreateInvitationTokenRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, String] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      us   <- ZIO.service[UserService]
      user <- user(request.bearerToken)(traceId)

      _ <- ZIO.logInfo(s"Creates an invitation token for ${request.targetPersonId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      inviteLink <- ZIO.ifZIO(s.ownsPerson(user.userId, request.targetPersonId))(
                     us.createInviteToken(request.targetPersonEmail, request.targetPersonId),
                     ZIO.fail(AccessToPersonDenied(request.targetPersonId)) <* ZIO.logError("User does not own the target person") @@ LogAnnotation.TraceId(traceId)
                   )
      _ <- ZIO.logInfo(s"An invitation created, token $inviteLink") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield inviteLink
  }

  def createFamily(request: CreateFamilyRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _        <- ZIO.logInfo(s"Creates a new family in stemma ${request.stemmaId}, desc ${request.familyDescr}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      familyId <- s.createFamily(user.userId, request.stemmaId, request.familyDescr)
      stemma   <- s.stemma(user.userId, request.stemmaId)
      _        <- ZIO.logInfo(s"Family with id ${familyId} created, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemma
  }

  def deleteFamily(request: DeleteFamilyRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _      <- ZIO.logInfo(s"Removes family ${request.familyId} in stemma ${request.stemmaId}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      _      <- s.removeFamily(user.userId, request.familyId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      <- ZIO.logInfo(s"Family removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemma
  }

  def updateFamily(request: UpdateFamilyRequest): ZIO[UserService with OAuthService with StemmaService, TracedStemmaError, Stemma] = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.bearerToken)(traceId)

      _      <- ZIO.logInfo(s"Updates family ${request.familyId} in stemma ${request.stemmaId}, desc ${request.familyDescr}") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
      _      <- s.updateFamily(user.userId, request.familyId, request.familyDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      <- ZIO.logInfo(s"Family updated, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total") @@ userLogAnnotation(user) @@ LogAnnotation.TraceId(traceId)
    } yield stemma
  }
}
