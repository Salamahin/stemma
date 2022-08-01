package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

case class StemmaDescription(id: String, name: String, removable: Boolean)

object StemmaDescription {
  implicit val encoder: JsonEncoder[StemmaDescription] = DeriveJsonEncoder.gen[StemmaDescription]
}
