package io.github.salamahin.stemma.domain

import io.circe.Encoder

case class ChownEffect(affectedFamilies: Seq[String], affectedPeople: Seq[String])

object ChownEffect {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[ChownEffect] = deriveEncoder[ChownEffect]
}
