package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class GetStemmaRequest(email: String, stemmaId: String)

object GetStemmaRequest {
  implicit val decoder: JsonDecoder[GetStemmaRequest] = DeriveJsonDecoder.gen[GetStemmaRequest]
}