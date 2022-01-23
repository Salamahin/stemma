package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}
import org.latestbit.circe.adt.codec.JsonAdt

import java.time.LocalDate

sealed trait PersonDefinition
@JsonAdt("existing") final case class ExistingPersonId(id: String)                                                           extends PersonDefinition
@JsonAdt("new") final case class PersonDescription(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) extends PersonDefinition

object PersonDefinition {
  import io.circe.generic.auto._
  import org.latestbit.circe.adt.codec._

  implicit val encoder: Encoder[PersonDefinition] = JsonTaggedAdtCodec.createEncoder[PersonDefinition]("type")
  implicit val decoder: Decoder[PersonDefinition] = JsonTaggedAdtCodec.createDecoder[PersonDefinition]("type")
}

object PersonDescription {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[PersonDescription] = deriveEncoder[PersonDescription]
  implicit val decoder: Decoder[PersonDescription] = deriveDecoder[PersonDescription]
}
