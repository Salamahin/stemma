package io.github.salamahin.stemma.domain

import io.circe.Decoder

case class Email(email: String) extends AnyVal {

  override def toString: String = {
    val Array(name, domain) = email.split("@")
    val redactedName        = name.take(3) + List.fill(name.length - 3)('*').mkString
    s"$redactedName@$domain"
  }
}

object Email {
  import io.circe.generic.semiauto._
  implicit val decoder: Decoder[Email] = deriveDecoder[Email]
}
