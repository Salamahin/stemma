package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

import java.time.LocalDate

sealed trait PersonDefinition
case class ExistingPerson(id: String)                                                                                     extends PersonDefinition
case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String]) extends PersonDefinition

object CreateNewPerson {
  implicit val createNewPersonDec: JsonDecoder[CreateNewPerson] = DeriveJsonDecoder.gen[CreateNewPerson]
}

object ExistingPerson {
  implicit val existingPersonDec: JsonDecoder[ExistingPerson] = DeriveJsonDecoder.gen[ExistingPerson]
}

object PersonDefinition {
  implicit val adtDec: JsonDecoder[PersonDefinition] = ExistingPerson.existingPersonDec.widen[PersonDefinition] orElse CreateNewPerson.createNewPersonDec.widen[PersonDefinition]
}
