package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

case class OwnedStemmasDescription(stemmas: Seq[StemmaDescription])

object OwnedStemmasDescription {
  implicit val encoder: JsonEncoder[OwnedStemmasDescription] = DeriveJsonEncoder.gen[OwnedStemmasDescription]
}
