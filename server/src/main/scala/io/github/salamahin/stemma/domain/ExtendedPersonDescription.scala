package io.github.salamahin.stemma.domain

case class ExtendedPersonDescription(personDescription: CreateNewPerson, childOf: Option[String], spouseOf: List[String], stemmaId: String, owner: String)
