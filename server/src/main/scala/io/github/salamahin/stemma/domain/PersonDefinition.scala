package io.github.salamahin.stemma.domain

import io.circe.Encoder
import io.circe.generic.extras.semiauto.deriveConfiguredEncoder

import java.time.LocalDate

sealed trait PersonDefinition
final case class ExistingPerson(id: String)                                                                extends PersonDefinition
final case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends PersonDefinition

object PersonDefinition extends Discriminated {
  implicit val encoder: Encoder[PersonDefinition] = deriveConfiguredEncoder[PersonDefinition]
}
