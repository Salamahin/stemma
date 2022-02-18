package io.github.salamahin.stemma.domain

import io.circe.Encoder

final case class CreateFamily(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])

object CreateFamily {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[CreateFamily] = deriveEncoder[CreateFamily]
}
