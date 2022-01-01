package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.service.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.service.response.{Child, Family, Spouse, Stemma, Person => ServicePerson}
import io.github.salamahin.stemma.storage.domain.{Person => PersonVertex}
import org.apache.commons.configuration.BaseConfiguration
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph

import java.time.format.DateTimeFormatter
import java.util.UUID

final case class NoSuchParentId(id: String)  extends RuntimeException(s"No parent with id $id found")
final case class NoSuchChildId(id: String)   extends RuntimeException(s"No child with id $id found")
final case class NoSuchPartnerId(id: String) extends RuntimeException(s"No person with id $id found")

class TinkerpopRepository(file: String) extends AutoCloseable {

  import gremlin.scala._
  import io.scalaland.chimney.dsl._

  private implicit val graph = {
    val config = new BaseConfiguration
    config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_EDGE_ID_MANAGER, "UUID")
    config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_VERTEX_ID_MANAGER, "UUID")
    TinkerGraph.open(config).asScala()
  }

  private val name       = Key[String]("name")
  private val birthDate  = Key[String]("birthDate")
  private val deathDate  = Key[String]("deathDate")
  private val dateFormat = DateTimeFormatter.ISO_DATE

  new GraphTraversalSource(graph.asJava())
    .io(file)
    .`with`(IO.reader, IO.graphson)
    .read()
    .iterate()

  private val personLabel    = "person"
  private val familyLabel    = "family"
  private val childRelation  = "childOf"
  private val spouseRelation = "spouseOf"

  def newPerson(request: PersonRequest) = {
    val birthDateProps = request.birthDate.map(this.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps = request.deathDate.map(this.deathDate -> dateFormat.format(_)).toSeq
    val nameProps      = this.name -> request.name :: Nil

    graph
      .V
      .hasLabel(personLabel)
      .has(this.name, request.name)
      .headOption()
      .map(_.id().toString())
      .getOrElse {
        val newVertex = graph + (personLabel, nameProps ++ birthDateProps ++ deathDateProps: _*)
        newVertex.id().toString
      }
  }

  def removePerson(uuid: UUID) = {
    graph.V(uuid).drop().iterate()
    graph
      .V
      .hasLabel(familyLabel)
      .where(_.in(spouseRelation).count().is(P.lte(1)))
      .where(_.out(childRelation).count().is(P.is(0)))
      .drop()
      .iterate()
  }

  def updatePerson(uuid: UUID, request: PersonRequest) = {
    graph
      .V(uuid)
      .head()
      .updateAs[PersonVertex](vertex => vertex.copy(name = request.name, birthDate = request.birthDate, deathDate = request.deathDate))
  }

  private def createNewFamily(partner1: Vertex, partner2: Vertex) = {
    val existingFamily =
      partner1
        .out()
        .hasLabel(familyLabel)
        .where(_.in(spouseRelation).id().is(partner2.id()))
        .headOption()

    existingFamily
      .getOrElse {
        val newFamily = graph + familyLabel
        partner1 --- spouseRelation --> newFamily
        partner2 --- spouseRelation --> newFamily
        newFamily
      }
  }

  def addFamily(request: FamilyRequest) = {
    val parent1 = graph.V(request.parent1Id).headOption().getOrElse(throw NoSuchParentId(request.parent1Id))
    val family = request
      .parent2Id
      .map(parent2Id => {
        val parent2 = graph.V(parent2Id).headOption().getOrElse(throw NoSuchParentId(parent2Id))
        createNewFamily(parent1, parent2)
      })
      .orElse(parent1.out(familyLabel).headOption())
      .getOrElse {
        val newFamily = graph + familyLabel
        parent1 --- spouseRelation --> newFamily
        newFamily
      }

    request
      .childrenIds
      .foreach(childId => {
        val child = graph.V(childId).headOption().getOrElse(throw NoSuchChildId(childId))
        family --- childRelation --> child
      })
  }

  def stemma() = {
    val people = graph.V.hasLabel(personLabel).toCC[PersonVertex].toList().map(storedToService)

    val families = graph.V.hasLabel(familyLabel).toList().map(x => Family(x.id.toString))

    val spouseRelations = graph
      .E
      .hasLabel(spouseRelation)
      .toList()
      .map(v => Spouse(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    val childRelations = graph
      .E
      .hasLabel(childRelation)
      .toList()
      .map(v => Child(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    Stemma(people, families, spouseRelations, childRelations)
  }

  private def storedToService(stored: PersonVertex) =
    stored
      .into[ServicePerson]
      .withFieldComputed(_.id, _.id.map(_.toString).get)
      .transform

  override def close(): Unit = {
    new GraphTraversalSource(graph.asJava())
      .io(file)
      .`with`(IO.writer, IO.graphson)
      .write()
      .iterate()
  }
}
