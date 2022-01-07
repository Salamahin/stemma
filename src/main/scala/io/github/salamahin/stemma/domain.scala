package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.response.Stemma

import java.time.LocalDate

sealed trait StemmaError
final case class NoSuchPersonId(id: String) extends RuntimeException(s"No person with id $id found") with StemmaError
final case class NoSuchFamilyId(id: String) extends RuntimeException(s"No family with id $id found") with StemmaError

trait StemmaRepository {
  def newPerson(request: PersonRequest): String
  def removePerson(id: String): Either[NoSuchPersonId, Unit]
  def updatePerson(id: String, request: PersonRequest): Either[NoSuchPersonId, Unit]

  def newFamily(parentId: String): Either[NoSuchPersonId, String]
  def newFamily(parent1Id: String, parent2Id: String): Either[NoSuchPersonId, String]
  def removeFamily(id: String): Either[NoSuchFamilyId, Unit]

  def addChild(familyId: String, personId: String): Either[StemmaError, Unit]
  def removeChild(familyId: String, personId: String): Either[StemmaError, Unit]

  def stemma(): Stemma
}

object request {
  final case class PersonRequest(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
  final case class FamilyRequest(parent1Id: String, parent2Id: Option[String])
}

object response {
  final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], generation: Int)
  final case class Family(id: String)
  final case class Spouse(id: String, source: String, target: String)
  final case class Child(id: String, source: String, target: String)

  final case class Stemma(people: List[Person], families: List[Family], spouses: List[Spouse], children: List[Child])
}
