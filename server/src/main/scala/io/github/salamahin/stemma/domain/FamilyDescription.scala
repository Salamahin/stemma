package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, DeriveJsonEncoder, JsonDecoder, JsonEncoder}

case class FamilyDescription(id: String, parents: List[String], children: List[String], readOnly: Boolean)

object FamilyDescription {
  implicit val decoder: JsonDecoder[FamilyDescription] = DeriveJsonDecoder.gen[FamilyDescription]
  implicit val encoder: JsonEncoder[FamilyDescription] = DeriveJsonEncoder.gen[FamilyDescription]
}
