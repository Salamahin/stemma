package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class DeleteFamilyRequest(email: String, stemmaId: String, familyId: String)
object DeleteFamilyRequest {
  implicit val decoder: JsonDecoder[DeleteFamilyRequest] = DeriveJsonDecoder.gen[DeleteFamilyRequest]
}