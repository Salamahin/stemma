package io.github.salamahin.stemma.service

import zio.{TaskLayer, ZIO, ZLayer}

trait UserSecrets {
  val secretString: String
}

object UserSecrets {
  val fromEnv: TaskLayer[UserSecrets] = {
    ZLayer(ZIO.attempt(new UserSecrets {
      override val secretString: String = sys.env.getOrElse("USER_SECRET", throw new IllegalStateException("USER_SECRET env var is missing"))
    }))
  }
}
