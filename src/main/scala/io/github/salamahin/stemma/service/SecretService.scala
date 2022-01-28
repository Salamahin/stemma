package io.github.salamahin.stemma.service

import zio.{Has, IO, TaskLayer}

import scala.io.Source
import scala.util.Using

object SecretService {
  trait Secret {
    val secret: String
  }

  type SECRET = Has[Secret]

  val dockerSecret: TaskLayer[SECRET] = IO
    .fromTry(Using(Source.fromFile("/docker/secret/invitation_secret"))(_.mkString))
    .map(s =>
      new Secret {
        override val secret: String = s
      }
    )
    .toLayer
}
