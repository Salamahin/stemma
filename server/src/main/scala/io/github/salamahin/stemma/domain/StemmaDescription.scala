package io.github.salamahin.stemma.domain

import io.circe.Encoder

case class StemmaDescription(id: String, name: String, removable: Boolean)

object StemmaDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[StemmaDescription] = deriveEncoder[StemmaDescription]
}
