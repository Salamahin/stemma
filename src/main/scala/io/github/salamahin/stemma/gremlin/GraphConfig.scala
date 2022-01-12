package io.github.salamahin.stemma.gremlin

import gremlin.scala.{Vertex, id, underlying}
import org.apache.commons.configuration.BaseConfiguration
import org.apache.tinkerpop.gremlin.tinkergraph.structure.{TinkerFactory, TinkerGraph}

import java.time.LocalDate
import java.util.UUID

object GraphConfig {
  def newGraph() = {

  }

  case class PersonVertex(
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
