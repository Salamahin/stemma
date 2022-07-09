package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

import java.time.LocalDate

sealed trait PersonDefinition
final case class ExistingPerson(id: String)                                                                                     extends PersonDefinition
final case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String]) extends PersonDefinition

object PersonDefinition {
  import cats.syntax.functor._
  import io.circe.generic.semiauto._
  import io.circe.syntax._

  implicit val epEncoder: Encoder[ExistingPerson]   = deriveEncoder[ExistingPerson]
  implicit val epDecoder: Decoder[ExistingPerson]   = deriveDecoder[ExistingPerson]
  implicit val cnpEncoder: Encoder[CreateNewPerson] = deriveEncoder[CreateNewPerson]
  implicit val cnpDecoder: Decoder[CreateNewPerson] = deriveDecoder[CreateNewPerson]

  implicit val encoder: Encoder[PersonDefinition] = Encoder.instance {
    case ep @ ExistingPerson(_)            => ep.asJson
    case cnp @ CreateNewPerson(_, _, _, _) => cnp.asJson
  }

  implicit val decoder: Decoder[PersonDefinition] = Decoder[ExistingPerson].widen or Decoder[CreateNewPerson].widen
}
