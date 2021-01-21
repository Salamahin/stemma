package io.github.salamahin.stemma

import java.time.LocalDate

final case class Kinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
final case class Family(parent1Id: Int, parent2Id: Option[Int], childrenIds: Seq[Int])
