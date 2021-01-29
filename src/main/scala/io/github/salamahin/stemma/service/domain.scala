package io.github.salamahin.stemma.service

import java.time.LocalDate

object domain {

  sealed trait Id {
    val id: String
  }
  sealed trait Node extends Id
  sealed trait Edge extends Id {
    val source: String
    val target: String
  }

  final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends Node
  final case class Family(id: String)                                                                           extends Node
  final case class Spouse(id: String, source: String, target: String)                                           extends Edge
  final case class Child(id: String, source: String, target: String)                                            extends Edge

  final case class Stemma(people: List[Person], families: List[Family], spouses: List[Spouse], children: List[Child])
}
