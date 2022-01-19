package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{ExtendedPersonDescription, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Stemma}

import java.time.LocalDate

sealed trait StemmaError
final case class NoSuchPersonId(id: String)                                               extends StemmaError
final case class NoSuchFamilyId(id: String)                                               extends StemmaError
final case class ChildAlreadyBelongsToFamily(familyId: String, personId: String)          extends StemmaError
final case class ChildBelongsToDifferentFamily(existentFamilyId: String, childId: String) extends StemmaError
final case class ChildDoesNotBelongToFamily(familyId: String, childId: String)            extends StemmaError
final case class SpouseAlreadyBelongsToFamily(familyId: String, personId: String)         extends StemmaError
final case class SpouseBelongsToDifferentFamily(familyId: String, personId: String)       extends StemmaError
final case class SpouseDoesNotBelongToFamily(familyId: String, personId: String)          extends StemmaError
final case class IncompleteFamily()                                                       extends StemmaError
final case class CompositeError(errs: List[StemmaError])                                  extends StemmaError
final case class DuplicatedIds(duplicatedIds: Seq[String])                                extends StemmaError

trait StemmaRepository {
  def newFamily(): String

  def newPerson(descr: PersonDescription): String
  def updatePerson(id: String, description: PersonDescription): Either[NoSuchPersonId, Unit]

  def removeFamily(id: String): Either[NoSuchFamilyId, Unit]
  def removePerson(id: String): Either[NoSuchPersonId, Unit]

  def describePerson(id: String): Either[NoSuchPersonId, ExtendedPersonDescription]
  def describeFamily(id: String): Either[NoSuchFamilyId, Family]

  def setSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit]
  def setChildRelation(familyId: String, personId: String): Either[StemmaError, Unit]

  def removeChildRelation(familyId: String, personId: String): Either[StemmaError, Unit]
  def removeSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit]

  def stemma(): Stemma
}

object request {
  sealed trait PersonDefinition
  final case class ExistingPersonId(id: String)                                                                extends PersonDefinition
  final case class PersonDescription(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends PersonDefinition

  final case class FamilyDescription(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])
  final case class ExtendedPersonDescription(personDescription: PersonDescription, childOf: Option[String], spouseOf: Option[String])
}

object response {
  final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
  final case class Family(id: String, parents: Seq[String], children: Seq[String])

  final case class Stemma(people: List[Person], families: List[Family])
}
