package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{StorageService, UserService}
import zio.ZIO

object API extends LazyLogging {
  private def user(email: String) =
    for {
      us <- ZIO.service[UserService]
      u  <- us.getOrCreateUser(email)
      _  = logger.info(s"User was associated with $u")
    } yield u

  def listStemmas(email: String) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _       = logger.info(s"[$user] Requested list of owned stemmas")
      stemmas <- s.listOwnedStemmas(user.userId)
      _       = logger.info(s"[$user] Onwed stemmas: ${stemmas.stemmas}")
    } yield stemmas

  def bearInvitation(email: String, request: BearInvitationRequest) =
    for {
      s    <- ZIO.service[StorageService]
      us   <- ZIO.service[UserService]
      user <- user(email)

      _     = logger.info(s"[$user] Bears invitation token ${request.encodedToken}")
      token <- us.decodeInviteToken(request.encodedToken)
      _     = logger.info(s"[$user] Token was successfully decoded, target person is ${token.targetPersonId}")

      _ <- if (token.inviteesEmail == user.email) ZIO.succeed((): Unit)
          else ZIO.fail(ForeignInviteToken()) <* ZIO.succeed(logger.error("User beared a foreign token"))

      result <- s.chown(user.userId, token.stemmaId, token.targetPersonId)

      _ = logger.info(s"[$user] Chown is complete, effected nodes $result")
    } yield TokenAccepted()

  def deleteStemma(email: String, request: DeleteStemmaRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _       = logger.info(s"[$user] Attempts to remove a stemma with id ${request.stemmaId}")
      _       <- s.removeStemma(user.userId, request.stemmaId)
      stemmas <- s.listOwnedStemmas(user.userId)
      _       = logger.info(s"[$user] Stemma removal succeed, onwed stemmas are $stemmas")
    } yield stemmas

  def createNewStemma(email: String, request: CreateNewStemmaRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _        = logger.info(s"[$user] Creates a new stemma with name ${request.stemmaName}")
      stemmaId <- s.createStemma(user.userId, request.stemmaName)
      _        = logger.info(s"[$user] New stemma with id $stemmaId created")
    } yield StemmaDescription(stemmaId, request.stemmaName, removable = true)

  def stemma(email: String, requst: GetStemmaRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _      = logger.info(s"[$user] Asks for stemma data with stemma id ${requst.stemmaId}")
      stemma <- s.stemma(user.userId, requst.stemmaId)
      _      = logger.info(s"[$user] Stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma

  def deletePerson(email: String, request: DeletePersonRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _      = logger.info(s"[$user] Deletes person with id ${request.personId} in stemma ${request.stemmaId}")
      _      <- s.removePerson(user.userId, request.personId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$user] Person removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma

  def updatePerson(email: String, request: UpdatePersonRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _      = logger.info(s"[$user] Updates person with id ${request.personId} in stemma ${request.stemmaId} with ${request.personDescr}")
      _      <- s.updatePerson(user.userId, request.personId, request.personDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$user] Person updated")
    } yield stemma

  def createInvitationToken(email: String, request: CreateInvitationTokenRequest) =
    for {
      s    <- ZIO.service[StorageService]
      us   <- ZIO.service[UserService]
      user <- user(email)

      _ = logger.info(s"[$user] Creates an invitation token for ${request.targetPersonId}")
      token <- ZIO.ifZIO(s.ownsPerson(user.userId, request.targetPersonId))(
                us.createInviteToken(request.targetPersonEmail, request.stemmaId, request.targetPersonId),
                ZIO.fail(AccessToPersonDenied(request.targetPersonId)) <* ZIO.succeed(logger.error(s"[$user] User does not own the target person"))
              )
      _ = logger.info(s"[$user] An invitation created, token $token")
    } yield InviteToken(token)

  def createFamily(email: String, request: CreateFamilyRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _        = logger.info(s"[$user] Creates a new family in stemma ${request.stemmaId}, desc ${request.familyDescr}")
      familyId <- s.createFamily(user.userId, request.stemmaId, request.familyDescr)
      stemma   <- s.stemma(user.userId, request.stemmaId)
      _        = logger.info(s"[$user] Family with id $familyId created, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma

  def deleteFamily(email: String, request: DeleteFamilyRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _      = logger.info(s"[$user] Removes family ${request.familyId} in stemma ${request.stemmaId}")
      _      <- s.removeFamily(user.userId, request.familyId)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$user] Family removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma

  def updateFamily(email: String, request: UpdateFamilyRequest) =
    for {
      s    <- ZIO.service[StorageService]
      user <- user(email)

      _      = logger.info(s"[$user] Updates family ${request.familyId} in stemma ${request.stemmaId}, desc ${request.familyDescr}")
      _      <- s.updateFamily(user.userId, request.familyId, request.familyDescr)
      stemma <- s.stemma(user.userId, request.stemmaId)
      _      = logger.info(s"[$user] Family updated, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
    } yield stemma
}
