package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class UpdatePersonRequest(email: String, stemmaId: String, personId: String, personDescr: CreateNewPerson)

object UpdatePersonRequest {
  implicit val decoder: JsonDecoder[UpdatePersonRequest] = DeriveJsonDecoder.gen[UpdatePersonRequest]
}
