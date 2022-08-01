package io.github.salamahin.stemma.service

import zio.{TaskLayer, ZIO, ZLayer}

import scala.io.Source
import scala.util.Using

trait Secrets {
  val postgresSecret: String
  val invitationSecret: String
}

object Secrets {
  val envSecrets: TaskLayer[Secrets] = {
    ZLayer(ZIO.attempt(new Secrets {
      private val postgre = sys.env.getOrElse("POSTGRES_SECRET", throw new IllegalStateException("POSTGRES_SECRET env var is missing"))
      private val inv     = sys.env.getOrElse("INVITE_SECRET", throw new IllegalStateException("INVITE_SECRET env var is missing"))

      override val postgresSecret: String   = postgre
      override val invitationSecret: String = inv
    }))
  }
}
