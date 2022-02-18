package io.github.salamahin.stemma.domain

import io.circe.Encoder

case class OwnedStemmasDescription(stemmas: Seq[StemmaDescription])

object OwnedStemmasDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[OwnedStemmasDescription] = deriveEncoder[OwnedStemmasDescription]
}
