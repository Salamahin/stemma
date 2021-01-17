package io.github.salamahin.stemma

import java.time.LocalDate

trait Gateway {
  def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Kinsman
  def updateKinsman(id: Int, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
  def kinsmen: Seq[Kinsman]

  def newFamily(parent1Id: Int, parent2Id: Option[Int], children: Seq[Int]): Family
  def updateFamily(id: Int, parent1Id: Int, parent2Id: Option[Int], children: Seq[Int])
  def families: Seq[Family]
}
