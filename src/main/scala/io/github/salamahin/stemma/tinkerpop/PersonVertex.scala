package io.github.salamahin.stemma.tinkerpop

import gremlin.scala.{Vertex, id, underlying}
import org.umlg.sqlg.structure.RecordId

case class PersonVertex(
  name: String,
  birthDate: Option[String],
  deathDate: Option[String],
  phone: Option[String],
  bio: Option[String],
  @id id: Option[RecordId] = None,
  @underlying vertex: Option[Vertex] = None
)
