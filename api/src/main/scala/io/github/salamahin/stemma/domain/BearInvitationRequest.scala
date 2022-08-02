package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class BearInvitationRequest(email: String, encodedToken: String)

object BearInvitationRequest {
  implicit val decoder: JsonDecoder[BearInvitationRequest] = DeriveJsonDecoder.gen[BearInvitationRequest]
}
