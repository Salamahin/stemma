package io.github.salamahin.stemma.domain

import io.circe.Encoder

final case class Family(id: String, parents: List[String], children: List[String])

object Family {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[Family] = deriveEncoder[Family]
}
