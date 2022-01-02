package io.github.salamahin.stemma.storage

import gremlin.scala.{Vertex, id, underlying}

import java.time.LocalDate
import java.util.UUID

object domain {
  case class Person(
    name: String,
    birthDate: Option[LocalDate],
    deathDate: Option[LocalDate],
    phone: Option[String],
    bio: Option[String],
    generation: Int,
    @id id: Option[UUID] = None,
    @underlying vertex: Option[Vertex] = None
  )
}
