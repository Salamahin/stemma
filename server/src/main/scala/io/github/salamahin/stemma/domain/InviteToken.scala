package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

case class InviteToken(inviteesEmail: String, targetPersonId: String, entropy: String)
object InviteToken {
  import io.circe.generic.semiauto._
  implicit val encoder: Encoder[InviteToken] = deriveEncoder[InviteToken]
  implicit val decoder: Decoder[InviteToken] = deriveDecoder[InviteToken]
}
