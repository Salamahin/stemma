package io.github.salamahin.stemma.storage

import gremlin.scala.{Vertex, id, underlying}

import java.time.LocalDate

object domain {
  case class Person(
    name: String,
    birthDate: Option[LocalDate],
    deathDate: Option[LocalDate],
    @id id: Option[String] = None,
    @underlying vertex: Option[Vertex] = None
  )
}
