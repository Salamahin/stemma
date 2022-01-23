package io.github.salamahin.stemma.tinkerpop

import gremlin.scala.{Vertex, id, underlying}

import java.time.LocalDate
import java.util.UUID

case class PersonVertex(
  name: String,
  birthDate: Option[String],
  deathDate: Option[String],
  phone: Option[String],
  bio: Option[String],
  @id id: Option[UUID] = None,
  @underlying vertex: Option[Vertex] = None
)
