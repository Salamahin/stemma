package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonDecoder, DeriveJsonEncoder, JsonDecoder, JsonEncoder}

case class InviteToken(inviteesEmail: String, targetPersonId: String, entropy: String)

object InviteToken {
  implicit val decoder: JsonDecoder[InviteToken] = DeriveJsonDecoder.gen[InviteToken]
  implicit val encoder: JsonEncoder[InviteToken] = DeriveJsonEncoder.gen[InviteToken]
}
