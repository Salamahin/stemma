package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

final case class FamilyDescription(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])

object FamilyDescription {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[FamilyDescription] = deriveEncoder[FamilyDescription]
  implicit val decoder: Decoder[FamilyDescription] = deriveDecoder[FamilyDescription]
}
