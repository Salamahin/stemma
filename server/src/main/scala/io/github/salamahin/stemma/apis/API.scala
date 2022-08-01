package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{StemmaService, UserService}
import zio.ZIO

import java.util.UUID

object API extends LazyLogging {
  private def traced[R, T](f: UUID => ZIO[R, StemmaError, T]) =
    ZIO.succeed(UUID.randomUUID()).flatMap(traceId => f(traceId).mapError(err => TracedStemmaError(traceId, err)))

  private def user(email: String)(traceId: UUID): ZIO[UserService, UnknownError, User] =
    for {
      us <- ZIO.service[UserService]
      u  <- us.getOrCreateUser(email)
      _  = logger.info(s"[$traceId] User was associated with $u")
    } yield u

  def listStemmas(request: ListStemmasRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _       = logger.info(s"[$traceId] [$user] Requested list of owned stemmas")
      stemmas <- s.listOwnedStemmas(user.userId)
      _       = logger.info(s"[$traceId] [$user] Onwed stemmas: ${stemmas.stemmas}")
    } yield stemmas
  }

  def bearInvitation(request: BearInvitationRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      us   <- ZIO.service[UserService]
      user <- user(request.email)(traceId)

      _     = logger.info(s"[$traceId] [$user] Bears invitation token ${request.encodedToken}")
      token <- us.decodeInviteToken(request.encodedToken)
      _     = logger.info(s"[$traceId] [$user] Token was successfully decoded, target person is ${token.targetPersonId}")

      _ <- if (token.inviteesEmail == user.email) ZIO.succeed((): Unit)
          else ZIO.fail(ForeignInviteToken()) <* ZIO.succeed(logger.error("User beared a foreign token"))

      result <- s.chown(user.userId, token.targetPersonId)

      _ = logger.info(s"[$traceId] [$user] Chown is complete, effected nodes $result")
    } yield ()
  }

  def deleteStemma(request: DeleteStemmaRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _       = logger.info(s"[$traceId] [$user] Attempts to remove a stemma with id ${request.stemmaId}")
      _       <- s.removeStemma(user.userId, request.stemmaId)
      stemmas <- s.listOwnedStemmas(user.userId)
      _       = logger.info(s"[$traceId] [$user] Stemma removal succeed, onwed stemmas are $stemmas")
    } yield stemmas
  }

  def createNewStemma(request: CreateNewStemmaRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _        = logger.info(s"[$traceId] [$user] Creates a new stemma with name ${request.stemmaName}")
      stemmaId <- s.createStemma(user.userId, request.stemmaName)
      _        = logger.info(s"[$traceId] [$user] New stemma with id $stemmaId created")
    } yield StemmaDescription(stemmaId, request.stemmaName, removable = true)
  }

  def stemma(request: GetStemmaRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _      = logger.info(s"[$traceId] [$user] Asks for stemma data with stemma id ${request.stemmaId}")
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$traceId] [$user] Stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
  }

  def deletePerson(request: DeletePersonRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _      = logger.info(s"[$traceId] [$user] Deletes person with id ${request.personId} in stemma ${request.stemmaId}")
      _      <- s.removePerson(user.userId, request.personId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$traceId] [$user] Person removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
  }

  def updatePerson(request: UpdatePersonRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _      = logger.info(s"[$traceId] [$user] Updates person with id ${request.personId} in stemma ${request.stemmaId} with ${request.personDescr}")
      _      <- s.updatePerson(user.userId, request.personId, request.personDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$traceId] [$user] Person updated")
    } yield stemma
  }

  def createInvitationToken(request: CreateInvitationTokenRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      us   <- ZIO.service[UserService]
      user <- user(request.email)(traceId)

      _ = logger.info(s"[$traceId] [$user] Creates an invitation token for ${request.targetPersonId}")
      inviteLink <- ZIO.ifZIO(s.ownsPerson(user.userId, request.targetPersonId))(
                     us.createInviteToken(request.targetPersonEmail, request.targetPersonId),
                     ZIO.fail(AccessToPersonDenied(request.targetPersonId)) <* ZIO.succeed(logger.error(s"[$traceId] [$user] User does not own the target person"))
                   )
      _ = logger.info(s"[$traceId] [$user] An invitation created, token $inviteLink")
    } yield inviteLink
  }

  def createFamily(request: CreateFamilyRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _        = logger.info(s"[$traceId] [$user] Creates a new family in stemma ${request.stemmaId}, desc ${request.familyDescr}")
      familyId <- s.createFamily(user.userId, request.stemmaId, request.familyDescr)
      stemma   <- s.stemma(user.userId, request.stemmaId)
      _        = logger.info(s"[$traceId] [$user] Family with id $familyId created, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
  }

  def deleteFamily(request: DeleteFamilyRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _      = logger.info(s"[$traceId] [$user] Removes family ${request.familyId} in stemma ${request.stemmaId}")
      _      <- s.removeFamily(user.userId, request.familyId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$traceId] [$user] Family removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
  }

  def updateFamily(request: UpdateFamilyRequest) = traced { traceId =>
    for {
      s    <- ZIO.service[StemmaService]
      user <- user(request.email)(traceId)

      _      = logger.info(s"[$traceId] [$user] Updates family ${request.familyId} in stemma ${request.stemmaId}, desc ${request.familyDescr}")
      _      <- s.updateFamily(user.userId, request.familyId, request.familyDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$traceId] [$user] Family updated, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
  }
}
