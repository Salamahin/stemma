package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

import java.time.LocalDate

final case class Person(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])

object Person {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[Person] = deriveEncoder[Person]
  implicit val decoder: Decoder[Person] = deriveDecoder[Person]
}
