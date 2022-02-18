package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

import java.time.LocalDate

final case class PersonDescription(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])

object PersonDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[PersonDescription] = deriveEncoder[PersonDescription]
}
