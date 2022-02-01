package io.github.salamahin.stemma.service

import zio.{Has, IO, TaskLayer}

import scala.io.Source
import scala.util.Using

object SecretService {
  trait Secret {
    val postgresSecret: String
    val invitationSecret: String
    val googleApiSecret: String
  }

  type SECRET = Has[Secret]

  val dockerSecret: TaskLayer[SECRET] = {
    val invitationSecret = IO.fromTry(Using(Source.fromFile("/docker/secret/invitation_secret"))(_.mkString))
    val googleApiSecret  = IO.fromTry(Using(Source.fromFile("/docker/secret/googleapi_secret"))(_.mkString))
    val postgresSecret   = IO.fromTry(Using(Source.fromFile("/docker/secret/postgres_secret"))(_.mkString))

    (invitationSecret zip googleApiSecret zip postgresSecret).map {
      case ((invite, google), postgres) =>
        new Secret {
          override val invitationSecret: String = invite
          override val googleApiSecret: String  = google
          override val postgresSecret: String   = postgres
        }
    }.toLayer
  }
}
