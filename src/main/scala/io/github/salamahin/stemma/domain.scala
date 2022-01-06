package io.github.salamahin.stemma

import java.time.LocalDate

object response {
  final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], generation: Int)
  final case class Family(id: String)
  final case class Spouse(id: String, source: String, target: String)
  final case class Child(id: String, source: String, target: String)

  final case class Stemma(people: List[Person], families: List[Family], spouses: List[Spouse], children: List[Child])
}

object request {
  final case class PersonRequest(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
  final case class FamilyRequest(parent1Id: String, parent2Id: Option[String], childrenIds: List[String])
}
