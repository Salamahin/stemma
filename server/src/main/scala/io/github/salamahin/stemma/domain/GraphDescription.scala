package io.github.salamahin.stemma.domain

import io.circe.Encoder

case class GraphDescription(id: String, name: String)

object GraphDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[GraphDescription] = deriveEncoder[GraphDescription]
}
