package io.github.salamahin.stemma

import java.time.LocalDate

case class Kinsman(id: Int, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
case class Family(id: Int, parent1Id: Int, parent2Id: Option[Int], childrenIds: Seq[Int])
