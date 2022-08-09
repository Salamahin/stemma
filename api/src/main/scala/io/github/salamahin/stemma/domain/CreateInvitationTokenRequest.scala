package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, JsonDecoder}

case class CreateInvitationTokenRequest(targetPersonId: String, targetPersonEmail: String)

object CreateInvitationTokenRequest {
  implicit val decoder: JsonDecoder[CreateInvitationTokenRequest] = DeriveJsonDecoder.gen[CreateInvitationTokenRequest]
}