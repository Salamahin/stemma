package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.service._
import zio.Random.RandomLive
import zio.{Scope, TaskLayer, ZLayer}

trait Layers {
  val layers: TaskLayer[StemmaService with UserService] =
    (Scope.default ++ ZLayer.succeed(RandomLive)) >+>
      (UserSecrets.fromEnv >+> JdbcConfiguration.fromEnv >+> GraphService.postgres) >>>
      (StemmaService.live ++ UserService.live)
}
