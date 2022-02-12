package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.{ULayer, ZLayer}

object OpsService {
  val live: ULayer[StemmaOperations] = ZLayer.succeed(new StemmaOperations)
}
