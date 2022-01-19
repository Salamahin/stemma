package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{ExtendedPersonDescription, FamilyDescription, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Stemma}
import zio.{IO, UIO}

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
