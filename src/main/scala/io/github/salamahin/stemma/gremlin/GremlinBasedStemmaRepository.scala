package io.github.salamahin.stemma.gremlin

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig.PersonVertex
import io.github.salamahin.stemma.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.response.{Child, Family, Spouse, Stemma, Person => ServicePerson}
import io.github.salamahin.stemma.{IncompleteFamily, NoSuchPersonId, StemmaError, StemmaRepository}

import java.time.format.DateTimeFormatter
import scala.annotation.tailrec

class GremlinBasedStemmaRepository(graph: ScalaGraph) extends StemmaRepository {
  import gremlin.scala._
  import io.scalaland.chimney.dsl._

  private implicit val _graph = graph

  private val dateFormat = DateTimeFormatter.ISO_DATE

  private val keys = new {
    val name       = Key[String]("name")
    val birthDate  = Key[String]("birthDate")
    val deathDate  = Key[String]("deathDate")
    val generation = Key[Int]("generation")
  }

  private val labels = new {
    val person   = "person"
    val family   = "family"
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
  }

  override def newPerson(request: PersonRequest): String = {
    val birthDateProps  = request.birthDate.map(keys.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps  = request.deathDate.map(keys.deathDate -> dateFormat.format(_)).toSeq
    val nameProps       = keys.name -> request.name
    val generationProps = keys.generation -> 0

    graph
      .V
      .hasLabel(labels.person)
      .has(keys.name, request.name)
      .headOption()
      .map(_.id().toString)
      .getOrElse {

        val newVertex = graph + (labels.person, nameProps +: generationProps +: (birthDateProps ++ deathDateProps): _*)
        newVertex.id().toString
      }
  }

  private def dropEmptyFamilies() = {
    graph
      .V
      .hasLabel(labels.family)
      .where(_.in(labels.spouseOf).count().is(P.lte(1)))
      .where(_.out(labels.childOf).count().is(P.is(0)))
      .drop()
      .iterate()
  }

  private def recalculateGenerations() = {
    @tailrec
    def iter(parents: List[String], generation: Int): Unit = {
      graph
        .V(parents: _*)
        .toList()
        .foreach(_.updateAs[PersonVertex](vertex => vertex.copy(generation = generation)))

      val children = graph
        .V(parents: _*)
        .out(labels.spouseOf)
        .out(labels.childOf)
        .map(_.id().toString)
        .toList()
        .distinct

      if (children.nonEmpty) iter(children, generation + 1)
    }

    val eldar = graph
      .V()
      .hasLabel(labels.person)
      .where(_.in(labels.childOf).count().is(P.eq(0)))
      .map(_.id().toString)
      .toList()

    iter(eldar, 0)
  }

  private def sanitizeGraph() = {
    dropEmptyFamilies()
    recalculateGenerations()
  }

  override def removePerson(id: String): Either[NoSuchPersonId, Unit] = {
    val person = graph.V(id).headOption()
    if (person.isEmpty) Left(NoSuchPersonId(id))
    else {
      person.foreach(p => {
        p.inE().drop().iterate()
        p.outE().drop().iterate()
        p.remove()
      })

      Right()
    }
  }

  override def updatePerson(id: String, request: PersonRequest): Either[NoSuchPersonId, Unit] = {
    graph
      .V(id)
      .headOption()
      .map(_.updateAs[PersonVertex](vertex => vertex.copy(name = request.name, birthDate = request.birthDate, deathDate = request.deathDate)))
      .map(_ => Right())
      .getOrElse(Left(NoSuchPersonId(id)))
  }

  private def createNewFamily(partner1: Vertex, partner2: Vertex) = {
    val existingFamily =
      partner1
        .out()
        .hasLabel(labels.family)
        .where(_.in(labels.spouseOf).id().is(partner2.id()))
        .headOption()

    existingFamily
      .getOrElse {
        val newFamily = graph + labels.family
        partner1 --- labels.spouseOf --> newFamily
        partner2 --- labels.spouseOf --> newFamily
        newFamily
      }
  }

  override def newFamily(request: FamilyRequest): Either[StemmaError, String] = {
    val parent1 = graph.V(request.parent1Id).headOption().getOrElse(throw NoSuchPersonId(request.parent1Id))
    val family = request
      .parent2Id
      .map(parent2Id => {
        val parent2 = graph.V(parent2Id).headOption().getOrElse(throw NoSuchPersonId(parent2Id))
        createNewFamily(parent1, parent2)
      })
      .orElse(parent1.out(labels.family).headOption())
      .getOrElse {
        val newFamily = graph + labels.family
        parent1 --- labels.spouseOf --> newFamily
        newFamily
      }

    request
      .childrenIds
      .foreach(childId => {
        val child = graph.V(childId).headOption().getOrElse(throw NoSuchPersonId(childId))
        family --- labels.childOf --> child
      })

    family.id().toString
  }

  override def stemma(): Stemma = {
    sanitizeGraph()

    val people   = graph.V.hasLabel(labels.person).toCC[PersonVertex].toList().map(storedToService)
    val families = graph.V.hasLabel(labels.family).toList().map(x => Family(x.id.toString))

    val spouseRelations = graph
      .E
      .hasLabel(labels.spouseOf)
      .toList()
      .map(v => Spouse(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    val childRelations = graph
      .E
      .hasLabel(labels.childOf)
      .toList()
      .map(v => Child(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    Stemma(people, families, spouseRelations, childRelations)
  }

  private def storedToService(stored: PersonVertex) =
    stored
      .into[ServicePerson]
      .withFieldComputed(_.id, _.id.map(_.toString).get)
      .transform
}
