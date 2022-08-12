package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{CreateFamily, CreateNewPerson, FamilyDescription, StemmaError}
import zio.IO

trait AbstractStemmaService {

  def createStemma(userId: String, name: String)

  def listOwnedStemmas(userId: String)

  def removeStemma(userId: String, stemmaId: String)

  def createFamily(userId: String, stemmaId: String, family: CreateFamily): IO[StemmaError, FamilyDescription]

  def updateFamily(userId: String, familyId: String, family: CreateFamily): IO[StemmaError, FamilyDescription]

  def removePerson(userId: String, personId: String)

  def removeFamily(userId: String, familyId: String)

  def updatePerson(userId: String, personId: String, description: CreateNewPerson)

  def stemma(userId: String, stemmaId: String)

  def chown(toUserId: String, targetPersonId: String)

  def ownsPerson(userId: String, personId: String): IO[StemmaError, Boolean]
}
