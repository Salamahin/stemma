package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class CreateFamily(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])

object CreateFamily {
  implicit val decoder: JsonDecoder[CreateFamily] = DeriveJsonDecoder.gen[CreateFamily]
}
