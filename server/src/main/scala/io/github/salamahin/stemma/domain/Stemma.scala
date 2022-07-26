package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

final case class Stemma(people: List[PersonDescription], families: List[FamilyDescription])

object Stemma {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[Stemma] = deriveEncoder[Stemma]
}
