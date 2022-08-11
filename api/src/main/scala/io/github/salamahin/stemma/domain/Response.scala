package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

import java.time.LocalDate

sealed trait Response

case class ChownEffect(affectedFamilies: Seq[String], affectedPeople: Seq[String])                                                                         extends Response
case class FamilyDescription(id: String, parents: List[String], children: List[String], readOnly: Boolean)                                                 extends Response
case class InviteToken(token: String)                                                                                                                      extends Response
case class OwnedStemmasDescription(stemmas: Seq[StemmaDescription])                                                                                        extends Response
case class Stemma(people: List[PersonDescription], families: List[FamilyDescription])                                                                      extends Response
case class StemmaDescription(id: String, name: String, removable: Boolean)                                                                                 extends Response
case class PersonDescription(id: String, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], readOnly: Boolean) extends Response
case class TokenAccepted()                                                                                                                                 extends Response

object FamilyDescription {
  implicit val encoder: JsonEncoder[FamilyDescription] = DeriveJsonEncoder.gen[FamilyDescription]
}

object PersonDescription {
  implicit val encoder: JsonEncoder[PersonDescription] = DeriveJsonEncoder.gen[PersonDescription]
}

object StemmaDescription {
  implicit val encoder: JsonEncoder[StemmaDescription] = DeriveJsonEncoder.gen[StemmaDescription]
}

object OwnedStemmasDescription {
  implicit val encoder: JsonEncoder[OwnedStemmasDescription] = DeriveJsonEncoder.gen[OwnedStemmasDescription]
}

object Response {
  implicit val encoder: JsonEncoder[Response] = DeriveJsonEncoder.gen[Response]
}
