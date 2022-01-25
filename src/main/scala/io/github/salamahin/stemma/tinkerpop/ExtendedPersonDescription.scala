package io.github.salamahin.stemma.tinkerpop

import io.github.salamahin.stemma.domain.PersonDescription

final case class ExtendedPersonDescription(personDescription: PersonDescription, childOf: Option[String], spouseOf: Option[String])
