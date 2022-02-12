package io.github.salamahin.stemma.domain

import io.circe.generic.extras.Configuration

trait Discriminated {
  implicit val circeConfig = Configuration.default.withDiscriminator("type")
}
