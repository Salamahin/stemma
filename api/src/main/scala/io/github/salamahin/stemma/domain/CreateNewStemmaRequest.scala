package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class CreateNewStemmaRequest(email: String, stemmaName: String)

object CreateNewStemmaRequest {
  implicit val decoder: JsonDecoder[CreateNewStemmaRequest] = DeriveJsonDecoder.gen[CreateNewStemmaRequest]
}