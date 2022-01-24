package io.github.salamahin.stemma.domain

import io.circe.generic.extras.{Configuration => CConfication}
import sttp.tapir.generic.{Configuration => TConfiguration}

trait Discriminated {
  implicit val circeConfig: CConfication   = CConfication.default.withDiscriminator("type")
  implicit val tapicConfig: TConfiguration = TConfiguration.default.withDiscriminator("type")
}
