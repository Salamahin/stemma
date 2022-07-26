package io.github.salamahin.stemma.domain

final case class ExtendedFamilyDescription(id: String, parents: List[String], children: List[String], stemmaId: String)
