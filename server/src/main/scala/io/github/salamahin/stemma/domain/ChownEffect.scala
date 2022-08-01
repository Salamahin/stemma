package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

case class ChownEffect(affectedFamilies: Seq[String], affectedPeople: Seq[String])

object ChownEffect {
  implicit val encoder: JsonEncoder[ChownEffect] = DeriveJsonEncoder.gen[ChownEffect]
}
