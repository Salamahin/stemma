package io.github.salamahin.stemma.apis.restful

import zio.{ZIO, ZLayer}

trait GoogleSecrets {
  val clientId: String
}

object GoogleSecrets {
  val fromEnv =
    ZLayer.fromZIO(ZIO.attempt(new GoogleSecrets {
      override val clientId: String = sys.env.getOrElse("GOOGLE_CLIENT_ID", throw new IllegalStateException("GOOGLE_CLIENT_ID env var is not set"))
    }))
}
