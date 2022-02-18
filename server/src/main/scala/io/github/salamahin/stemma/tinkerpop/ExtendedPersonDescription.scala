package io.github.salamahin.stemma.tinkerpop

import io.github.salamahin.stemma.domain.CreateNewPerson

final case class ExtendedPersonDescription(personDescription: CreateNewPerson, childOf: Option[String], spouseOf: List[String], graphId: String, owner: String)
