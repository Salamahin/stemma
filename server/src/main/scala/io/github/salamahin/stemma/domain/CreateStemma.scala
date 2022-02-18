package io.github.salamahin.stemma.domain

import io.circe.Decoder

case class CreateStemma(name: String)

object CreateStemma {
  import io.circe.generic.semiauto._
  implicit val decoder: Decoder[CreateStemma] = deriveDecoder[CreateStemma]
}
