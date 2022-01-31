package io.github.salamahin.stemma.service

import zio.{Has, IO, TaskLayer}

import scala.io.Source
import scala.util.Using

object SecretService {
  trait Secret {
    val invitationSecret: String
    val googleApiSecret: String
  }

  type SECRET = Has[Secret]

  val dockerSecret: TaskLayer[SECRET] = {
    val invitationSecret = IO.fromTry(Using(Source.fromFile("/docker/secret/invitation_secret"))(_.mkString))
    val googleApiSecret  = IO.fromTry(Using(Source.fromFile("/docker/secret/googleapi_secret"))(_.mkString))

    (invitationSecret zip googleApiSecret).map {
      case (invite, google) =>
        new Secret {
          override val invitationSecret: String = invite
          override val googleApiSecret: String   = google
        }
    }.toLayer
  }
}
