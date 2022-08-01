package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.service.{GraphService, Secrets, StemmaService, UserService}
import zio.Random.RandomLive
import zio.{Scope, TaskLayer, ZLayer}

trait Layers {
  val layers: TaskLayer[StemmaService with UserService] =
    (Scope.default ++ ZLayer.succeed(RandomLive)) >+>
      (Secrets.envSecrets >+> GraphService.postgres) >>>
      (StemmaService.live ++ UserService.live)
}
