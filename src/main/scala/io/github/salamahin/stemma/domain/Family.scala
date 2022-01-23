package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

final case class Family(id: String, parents: Seq[String], children: Seq[String])

object Family {
  import io.circe.generic.semiauto._

  implicit val encoder: Encoder[Family] = deriveEncoder[Family]
  implicit val decoder: Decoder[Family] = deriveDecoder[Family]
}
