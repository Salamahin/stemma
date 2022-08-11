package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, DeriveJsonEncoder, JsonDecoder, JsonEncoder}

import java.time.LocalDate

case class CreateFamily(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])

sealed trait PersonDefinition
case class ExistingPerson(id: String)                                                                                     extends PersonDefinition
case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String]) extends PersonDefinition

sealed trait Request
case class CreateFamilyRequest(stemmaId: String, familyDescr: CreateFamily)                      extends Request
case class CreateInvitationTokenRequest(targetPersonId: String, targetPersonEmail: String)       extends Request
case class CreateNewStemmaRequest(stemmaName: String)                                            extends Request
case class DeleteFamilyRequest(stemmaId: String, familyId: String)                               extends Request
case class DeletePersonRequest(stemmaId: String, personId: String)                               extends Request
case class GetStemmaRequest(stemmaId: String)                                                    extends Request
case class DeleteStemmaRequest(stemmaId: String)                                                 extends Request
case class ListStemmasRequest()                                                                  extends Request
case class UpdatePersonRequest(stemmaId: String, personId: String, personDescr: CreateNewPerson) extends Request
case class UpdateFamilyRequest(stemmaId: String, familyId: String, familyDescr: CreateFamily)    extends Request
case class BearInvitationRequest(encodedToken: String)                                           extends Request

object PersonDefinition {
  implicit val decoder: JsonDecoder[PersonDefinition] = DeriveJsonDecoder.gen[PersonDefinition]
  implicit val encoder: JsonEncoder[PersonDefinition] = DeriveJsonEncoder.gen[PersonDefinition]
}

object CreateNewPerson {
  implicit val decoder: JsonDecoder[CreateNewPerson] = DeriveJsonDecoder.gen[CreateNewPerson]
  implicit val encoder: JsonEncoder[CreateNewPerson] = DeriveJsonEncoder.gen[CreateNewPerson]
}

object CreateFamily {
  implicit val decoder: JsonDecoder[CreateFamily] = DeriveJsonDecoder.gen[CreateFamily]
  implicit val encoder: JsonEncoder[CreateFamily] = DeriveJsonEncoder.gen[CreateFamily]
}
object UpdatePersonRequest {
  implicit val decoder: JsonDecoder[UpdatePersonRequest] = DeriveJsonDecoder.gen[UpdatePersonRequest]
  implicit val encoder: JsonEncoder[UpdatePersonRequest] = DeriveJsonEncoder.gen[UpdatePersonRequest]
}

object Request {
  implicit val requestDecoder: JsonDecoder[Request] = DeriveJsonDecoder.gen[Request]
  implicit val requestEncoder: JsonEncoder[Request] = DeriveJsonEncoder.gen[Request]
}
