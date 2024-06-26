package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{StorageService, UserService}
import zio.{IO, URLayer, ZIO, ZLayer}

trait ApiService {
  def listDescribeStemmas(email: String, request: ListDescribeStemmasRequest): IO[StemmaError, OwnedStemmas]
  def bearInvitation(email: String, request: BearInvitationRequest): IO[StemmaError, TokenAccepted]
  def deleteStemma(email: String, request: DeleteStemmaRequest): IO[StemmaError, OwnedStemmas]
  def createNewStemma(email: String, request: CreateNewStemmaRequest): IO[StemmaError, StemmaDescription]
  def stemma(email: String, requst: GetStemmaRequest): IO[StemmaError, Stemma]
  def deletePerson(email: String, request: DeletePersonRequest): IO[StemmaError, Stemma]
  def updatePerson(email: String, request: UpdatePersonRequest): IO[StemmaError, Stemma]
  def createInvitationToken(email: String, request: CreateInvitationTokenRequest): IO[StemmaError, InviteToken]
  def createFamily(email: String, request: CreateFamilyRequest): IO[StemmaError, Stemma]
  def deleteFamily(email: String, request: DeleteFamilyRequest): IO[StemmaError, Stemma]
  def updateFamily(email: String, request: UpdateFamilyRequest): IO[StemmaError, Stemma]
  def cloneStemma(email: String, request: CloneStemmaRequest): IO[StemmaError, CloneResult]
}

object ApiService extends LazyLogging {
  val live: URLayer[StorageService with UserService, ApiService] = ZLayer.fromZIO(for {
    us <- ZIO.service[UserService]
    s  <- ZIO.service[StorageService]
  } yield new ApiService {
    private def user(email: String) =
      for {
        u <- us.getOrCreateUser(email)
        _ = logger.info(s"User was associated with $u")
      } yield u

    override def listDescribeStemmas(email: String, request: ListDescribeStemmasRequest): IO[StemmaError, OwnedStemmas] = {
      for {
        user <- user(email)

        _               = logger.info(s"[$user] Requested list of owned stemmas with first stemma description")
        existingStemmas <- s.listOwnedStemmas(user.userId)

        createdStemma <- if (existingStemmas.isEmpty) {
                          logger.info(s"User has no stemmas yet, would create a new one with name ${request.defaultStemmaName}")
                          s.createStemma(user.userId, request.defaultStemmaName).map(Some.apply)
                        } else {
                          ZIO.succeed(None)
                        }

        describedStemma <- if (existingStemmas.isEmpty) ZIO.succeed(None) else s.stemma(user.userId, existingStemmas.head.id).map(Some.apply).orDie
        _               = logger.info(s"[$user] Onwed stemmas: $existingStemmas")
      } yield OwnedStemmas(
        existingStemmas ++ createdStemma.map(id => StemmaDescription(id, request.defaultStemmaName, true)),
        Some(describedStemma.getOrElse(Stemma(Nil, Nil)))
      )
    }

    def bearInvitation(email: String, request: BearInvitationRequest) =
      for {
        user <- user(email)

        _     = logger.info(s"[$user] Bears invitation token ${request.encodedToken}")
        token <- us.decodeInviteToken(request.encodedToken)
        _     = logger.info(s"[$user] Token was successfully decoded, target person is ${token.targetPersonId}, bearer email should be ${token.inviteesEmail}")

        _ <- if (token.inviteesEmail.toLowerCase.trim == user.email.toLowerCase) ZIO.succeed((): Unit)
            else ZIO.fail(ForeignInviteToken()) <* ZIO.succeed(logger.error(s"[$user] beared a foreign token, invitees email should be ${token.inviteesEmail}"))

        chownResult  <- s.chown(user.userId, token.stemmaId, token.targetPersonId)
        ownedStemmas <- s.listOwnedStemmas(user.userId)
        stemmaDescr  <- s.stemma(user.userId, token.stemmaId)

        _ = logger.info(s"[$user] Chown is complete, updated ownship on ${chownResult.affectedPeople.size} people and ${chownResult.affectedFamilies.size} families")
      } yield TokenAccepted(ownedStemmas, stemmaDescr)

    def deleteStemma(email: String, request: DeleteStemmaRequest) =
      for {
        user <- user(email)

        _       = logger.info(s"[$user] Attempts to remove a stemma with id ${request.stemmaId}")
        _       <- s.removeStemma(user.userId, request.stemmaId)
        stemmas <- s.listOwnedStemmas(user.userId)
        _       = logger.info(s"[$user] Stemma removal succeed, onwed stemmas are $stemmas")
      } yield OwnedStemmas(stemmas, None)

    def createNewStemma(email: String, request: CreateNewStemmaRequest) =
      for {
        user <- user(email)

        _        = logger.info(s"[$user] Creates a new stemma with name ${request.stemmaName}")
        stemmaId <- s.createStemma(user.userId, request.stemmaName)
        _        = logger.info(s"[$user] New stemma with id $stemmaId created")
      } yield StemmaDescription(stemmaId, request.stemmaName, removable = true)

    def stemma(email: String, requst: GetStemmaRequest) =
      for {
        user <- user(email)

        _      = logger.info(s"[$user] Asks for stemma data with stemma id ${requst.stemmaId}")
        stemma <- s.stemma(user.userId, requst.stemmaId)
        _      = logger.info(s"[$user] Stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
      } yield stemma

    def deletePerson(email: String, request: DeletePersonRequest) =
      for {
        user <- user(email)

        _      = logger.info(s"[$user] Deletes person with id ${request.personId} in stemma ${request.stemmaId}")
        _      <- s.removePerson(user.userId, request.personId)
        stemma <- s.stemma(user.userId, request.stemmaId)
        _      = logger.info(s"[$user] Person removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
      } yield stemma

    def updatePerson(email: String, request: UpdatePersonRequest) =
      for {
        user <- user(email)

        _      = logger.info(s"[$user] Updates person with id ${request.personId} in stemma ${request.stemmaId} with ${request.personDescr}")
        _      <- s.updatePerson(user.userId, request.personId, request.personDescr)
        stemma <- s.stemma(user.userId, request.stemmaId)
        _      = logger.info(s"[$user] Person updated")
      } yield stemma

    def createInvitationToken(email: String, request: CreateInvitationTokenRequest) =
      for {
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
        user <- user(email)

        _                     = logger.info(s"[$user] Creates a new family in stemma ${request.stemmaId}, desc ${request.familyDescr}")
        (stemma, familyDescr) <- s.createFamily(user.userId, request.stemmaId, request.familyDescr)
        _                     = logger.info(s"[$user] Family with id ${familyDescr.id} created, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
      } yield stemma

    def deleteFamily(email: String, request: DeleteFamilyRequest) =
      for {
        user <- user(email)

        _      = logger.info(s"[$user] Removes family ${request.familyId} in stemma ${request.stemmaId}")
        _      <- s.removeFamily(user.userId, request.familyId)
        stemma <- s.stemma(user.userId, request.stemmaId)
        _      = logger.info(s"[$user] Family removed, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
      } yield stemma

    def updateFamily(email: String, request: UpdateFamilyRequest) =
      for {
        user <- user(email)

        _           = logger.info(s"[$user] Updates family ${request.familyId} in stemma ${request.stemmaId}, desc ${request.familyDescr}")
        (stemma, _) <- s.updateFamily(user.userId, request.familyId, request.familyDescr)
        _           = logger.info(s"[$user] Family updated, now stemma has ${stemma.people.size} people and ${stemma.families.size} families total")
      } yield stemma

    override def cloneStemma(email: String, request: CloneStemmaRequest): IO[StemmaError, CloneResult] =
      for {
        user         <- user(email)
        _            = logger.info(s"[$user] Asks to clone stemma with id ${request.stemmaId} into new stemma called ${request.stemmaName}")
        clonedStemma <- s.cloneStemma(user.userId, request.stemmaId, request.stemmaName)
        ownedStemmas <- s.listOwnedStemmas(user.userId)
        _            = logger.info(s"[$user] Stemma cloned, it has ${clonedStemma.people.size} people and ${clonedStemma.families.size} families total, the user owns ${ownedStemmas.size} stemmas total")
      } yield CloneResult(clonedStemma, ownedStemmas)
  })
}
