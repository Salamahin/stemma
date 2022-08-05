package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class CreateFamilyRequest(stemmaId: String, familyDescr: CreateFamily)

object CreateFamilyRequest {
  implicit val decoder: JsonDecoder[CreateFamilyRequest] = DeriveJsonDecoder.gen[CreateFamilyRequest]
}
