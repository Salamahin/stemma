package io.github.salamahin.stemma.domain

import io.circe.Encoder

import java.time.LocalDate

final case class PersonDescription(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], readOnly: Boolean)

object PersonDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[PersonDescription] = deriveEncoder[PersonDescription]
}
