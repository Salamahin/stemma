package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

final case class Stemma(people: List[Person], families: List[Family])

object Stemma {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[Stemma] = deriveEncoder[Stemma]
  implicit val decoder: Decoder[Stemma] = deriveDecoder[Stemma]
}
