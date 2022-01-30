package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.{Has, ULayer, ZLayer}

object OpsService {
  type OPS = Has[StemmaOperations]

  val live: ULayer[OPS] = ZLayer.succeed(new StemmaOperations)
}
