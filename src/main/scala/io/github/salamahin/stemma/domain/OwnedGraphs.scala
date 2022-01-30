package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

case class OwnedGraphs(graphs: Seq[GraphDescription])

object OwnedGraphs {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[OwnedGraphs] = deriveEncoder[OwnedGraphs]
  implicit val decoder: Decoder[OwnedGraphs] = deriveDecoder[OwnedGraphs]
}
