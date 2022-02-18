package io.github.salamahin.stemma.domain

import io.circe.Encoder

case class OwnedGraphsDescription(graphs: Seq[GraphDescription])

object OwnedGraphsDescription {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[OwnedGraphsDescription] = deriveEncoder[OwnedGraphsDescription]
}
