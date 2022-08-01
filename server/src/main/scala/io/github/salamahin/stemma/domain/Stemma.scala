package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

case class Stemma(people: List[PersonDescription], families: List[FamilyDescription])

object Stemma {
  implicit val encoder: JsonEncoder[Stemma] = DeriveJsonEncoder.gen[Stemma]
}
