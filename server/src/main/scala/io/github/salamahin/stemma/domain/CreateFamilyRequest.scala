package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class CreateFamilyRequest(email: String, stemmaId: String, familyDescr: CreateFamily)

object CreateFamilyRequest {
  implicit val decoder: JsonDecoder[CreateFamilyRequest] = DeriveJsonDecoder.gen[CreateFamilyRequest]
}
