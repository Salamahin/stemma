package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class ListStemmasRequest(email: String)

object ListStemmasRequest {
  implicit val decoder: JsonDecoder[ListStemmasRequest] = DeriveJsonDecoder.gen[ListStemmasRequest]
}
