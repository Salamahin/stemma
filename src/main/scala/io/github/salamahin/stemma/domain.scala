package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{FamilyDescription, PersonDescription}
import io.github.salamahin.stemma.response.Stemma

import java.time.LocalDate

sealed trait StemmaError
final case class NoSuchPersonId(id: String)                                                     extends StemmaError
final case class NoSuchFamilyId(id: String)                                                     extends StemmaError
final case class SuchFamilyAlreadyExist(familyId: String, parent1Id: String, parent2Id: String) extends StemmaError
final case class ChildBelongsToDifferentFamily(childId: String, existentFamilyId: String)       extends StemmaError
final case class CompositeError(errs: List[StemmaError])                                        extends StemmaError
final case class IncompleteFamily()                                                             extends StemmaError

trait StemmaRepository {
  def newPerson(request: PersonDescription): String
  def describePerson(id: String): Either[NoSuchPersonId, PersonDescription]
  def removePersonIfExist(id: String): Unit
  def updatePerson(id: String, request: PersonDescription): Either[NoSuchPersonId, Unit]

  def newFamily(request: FamilyDescription): Either[StemmaError, String]
  def describeFamily(familyId: String): Either[NoSuchFamilyId, FamilyDescription]
  def removeFamilyIfExist(id: String): Unit
  def updateFamily(id: String, request: FamilyDescription): Either[StemmaError, Unit]

  def stemma(): Stemma
}

object request {
  sealed trait PersonDefinition
  final case class ExistingPersonId(id: String)                                                                extends PersonDefinition
  final case class PersonDescription(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends PersonDefinition

  final case class FamilyDescription(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])
}

object response {
  final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
  final case class Family(id: String, parents: Seq[String], children: Seq[String])

  final case class Stemma(people: List[Person], families: List[Family])
}
