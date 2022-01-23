package io.github.salamahin.stemma.domain

import io.circe.generic.extras.Configuration

trait Discriminated {
  implicit val discriminatedConfig: Configuration = Configuration.default.withDefaults.withDiscriminator("type")
}
