package io.github.salamahin.stemma.apis.rest

import zio.{TaskLayer, ZIO, ZLayer}

trait Google {
  val clientId: String
}

object Google {
  val fromEnv: TaskLayer[Google] = {
    ZLayer(ZIO.attempt(new Google {
      override val clientId: String = sys.env.getOrElse("GOOGLEAPI_SECRET", throw new IllegalStateException("GOOGLEAPI_SECRET env var is missing"))
    }))
  }
}
