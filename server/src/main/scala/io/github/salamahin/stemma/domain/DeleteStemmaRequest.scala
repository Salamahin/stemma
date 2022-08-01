package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class DeleteStemmaRequest(email: String, stemmaId: String)

object DeleteStemmaRequest {
  implicit val decoder: JsonDecoder[DeleteStemmaRequest] = DeriveJsonDecoder.gen[DeleteStemmaRequest]
}
