package io.github.salamahin.stemma.service

import zio.{TaskLayer, ZIO, ZLayer}

import scala.io.Source
import scala.util.Using

trait Secrets {
  val postgresSecret: String
  val invitationSecret: String
  val googleApiSecret: String
}

object Secrets {
  val dockerSecrets: TaskLayer[Secrets] = {
    val invitationSecret = ZIO.fromTry(Using(Source.fromFile("/docker/secret/invitation_secret"))(_.mkString))
    val googleApiSecret  = ZIO.fromTry(Using(Source.fromFile("/docker/secret/googleapi_secret"))(_.mkString))
    val postgresSecret   = ZIO.fromTry(Using(Source.fromFile("/docker/secret/postgres_secret"))(_.mkString))

    ZLayer((invitationSecret zip googleApiSecret zip postgresSecret).map {
      case (invite, google, postgres) =>
        new Secrets {
          override val invitationSecret: String = invite
          override val googleApiSecret: String  = google
          override val postgresSecret: String   = postgres
        }
    })
  }

  val envSecrets: TaskLayer[Secrets] = {
    ZLayer(ZIO.attempt(new Secrets {
      private val postgre = sys.env.getOrElse("POSTGRES_SECRET", throw new IllegalStateException("POSTGRES_SECRET env var is missing"))
      private val inv     = sys.env.getOrElse("INVITE_SECRET", throw new IllegalStateException("INVITE_SECRET env var is missing"))
      private val google  = sys.env.getOrElse("GOOGLEAPI_SECRET", throw new IllegalStateException("GOOGLEAPI_SECRET env var is missing"))

      override val postgresSecret: String   = postgre
      override val invitationSecret: String = inv
      override val googleApiSecret: String  = google
    }))
  }
}
