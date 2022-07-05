package io.github.salamahin.stemma.domain

import io.circe.generic.extras.semiauto.{deriveConfiguredDecoder, deriveConfiguredEncoder}
import io.circe.{Decoder, Encoder}

import java.time.LocalDate

sealed trait PersonDefinition
final case class ExistingPerson(id: String)                                                                extends PersonDefinition
final case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends PersonDefinition

object PersonDefinition extends Discriminated {
  implicit val encoder: Encoder[PersonDefinition] = deriveConfiguredEncoder[PersonDefinition]
  implicit val decoder: Decoder[PersonDefinition] = deriveConfiguredDecoder[PersonDefinition]
}
