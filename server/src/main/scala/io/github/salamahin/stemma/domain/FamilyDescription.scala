package io.github.salamahin.stemma.domain

import io.circe.Encoder

final case class FamilyDescription(id: String, parents: List[String], children: List[String], readOnly: Boolean)

object FamilyDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[FamilyDescription] = deriveEncoder[FamilyDescription]
}
