package io.github.salamahin.stemma.domain

import io.circe.Decoder

case class CreateGraph(name: String)

object CreateGraph {
  import io.circe.generic.semiauto._
  implicit val decoder: Decoder[CreateGraph] = deriveDecoder[CreateGraph]
}
