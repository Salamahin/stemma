package io.github.salamahin.stemma

import java.time.LocalDate

sealed trait Id {
  val id: Int
}
sealed trait Node extends Id
sealed trait Edge extends Id {
  val source: Int
  val target: Int
}

final case class Person(id: Int, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends Node
final case class Family(id: Int)                                                                           extends Node
final case class Spouse private (id: Int, source: Int, target: Int)                                        extends Edge
final case class Child private (id: Int, source: Int, target: Int)                                         extends Edge

object Spouse {
  def single(id: Int, person: Person, family: Family) = new Spouse(id, person.id, family.id)
  def pair(id: Int, partner1: Person, partner2: Person, family: Family) =
    new Spouse(id, partner1.id, family.id) :: new Spouse(id, partner2.id, family.id) :: Nil
}

object Child {
  def apply(id: Int, family: Family, child: Person) = new Child(id, family.id, child.id)
}
