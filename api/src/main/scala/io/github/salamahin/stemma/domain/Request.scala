package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

import java.time.LocalDate

sealed trait PersonDefinition
case class ExistingPerson(id: Long)                                                                                       extends PersonDefinition
case class CreateNewPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String]) extends PersonDefinition

case class CreateFamily(parent1: Option[PersonDefinition], parent2: Option[PersonDefinition], children: List[PersonDefinition])

sealed trait Request

case class CreateFamilyRequest(stemmaId: Long, familyDescr: CreateFamily)                 extends Request
case class UpdateFamilyRequest(stemmaId: Long, familyId: Long, familyDescr: CreateFamily) extends Request
case class DeleteFamilyRequest(stemmaId: Long, familyId: Long)                            extends Request

case class CreateInvitationTokenRequest(targetPersonId: Long, targetPersonEmail: String) extends Request
case class BearInvitationRequest(encodedToken: String)                                   extends Request

case class CreateNewStemmaRequest(stemmaName: String) extends Request
case class GetStemmaRequest(stemmaId: Long)           extends Request
case class DeleteStemmaRequest(stemmaId: Long)        extends Request
case class ListStemmasRequest()                       extends Request

case class DeletePersonRequest(stemmaId: Long, personId: Long)                               extends Request
case class UpdatePersonRequest(stemmaId: Long, personId: Long, personDescr: CreateNewPerson) extends Request

object PersonDefinition {
  implicit val decoder: JsonDecoder[PersonDefinition] = DeriveJsonDecoder.gen[PersonDefinition]
}

object CreateNewPerson {
  implicit val decoder: JsonDecoder[CreateNewPerson] = DeriveJsonDecoder.gen[CreateNewPerson]
}

object CreateFamily {
  implicit val decoder: JsonDecoder[CreateFamily] = DeriveJsonDecoder.gen[CreateFamily]
}

object UpdatePersonRequest {
  implicit val decoder: JsonDecoder[UpdatePersonRequest] = DeriveJsonDecoder.gen[UpdatePersonRequest]
}

object Request {
  implicit val requestDecoder: JsonDecoder[Request] = DeriveJsonDecoder.gen[Request]
}
