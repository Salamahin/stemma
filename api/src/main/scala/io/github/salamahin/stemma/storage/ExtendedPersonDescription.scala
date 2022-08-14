package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.domain.CreateNewPerson

case class ExtendedPersonDescription(personDescription: CreateNewPerson, childOf: Option[String], spouseOf: List[String], stemmaId: String, owners: List[String])
