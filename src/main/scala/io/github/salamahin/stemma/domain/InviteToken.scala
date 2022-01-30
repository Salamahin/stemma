package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class InviteToken(inviteesEmail: String, targetPersonId: String)
object InviteToken {
  implicit val encoder: Encoder[InviteToken] = deriveEncoder[InviteToken]
  implicit val decoder: Decoder[InviteToken] = deriveDecoder[InviteToken]
}
