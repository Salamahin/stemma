package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, DeriveJsonEncoder, JsonDecoder, JsonEncoder}

import java.time.LocalDate

case class PersonDescription(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], readOnly: Boolean)

object PersonDescription {
  implicit val encoder: JsonEncoder[PersonDescription] = DeriveJsonEncoder.gen[PersonDescription]
  implicit val decoder: JsonDecoder[PersonDescription] = DeriveJsonDecoder.gen[PersonDescription]
}
