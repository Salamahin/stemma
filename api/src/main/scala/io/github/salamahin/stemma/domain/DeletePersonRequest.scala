package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class DeletePersonRequest(email: String, stemmaId: String, personId: String)

object DeletePersonRequest {
  implicit val decoder: JsonDecoder[DeletePersonRequest] = DeriveJsonDecoder.gen[DeletePersonRequest]
}