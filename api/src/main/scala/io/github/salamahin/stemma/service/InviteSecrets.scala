package io.github.salamahin.stemma.service

import zio.{TaskLayer, ZIO, ZLayer}

trait InviteSecrets {
  val secretString: String
}

object InviteSecrets {
  val fromEnv: TaskLayer[InviteSecrets] = {
    ZLayer(ZIO.attempt(new InviteSecrets {
      override val secretString: String = sys.env.getOrElse("INVITE_SECRET", throw new IllegalStateException("INVITE_SECRET env var is missing"))
    }))
  }
}
