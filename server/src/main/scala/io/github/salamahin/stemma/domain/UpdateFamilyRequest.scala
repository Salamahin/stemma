package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class UpdateFamilyRequest(email: String, stemmaId: String, familyId: String, familyDescr: CreateFamily)

object UpdateFamilyRequest {
  implicit val decoder: JsonDecoder[UpdateFamilyRequest] = DeriveJsonDecoder.gen[UpdateFamilyRequest]
}
