package io.github.salamahin.stemma.gremlin

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig.PersonVertex
import io.github.salamahin.stemma.request.PersonRequest
import io.github.salamahin.stemma.response.{Child, Family, Spouse, Stemma, Person => ServicePerson}
import io.github.salamahin.stemma.{NoSuchFamilyId, NoSuchPersonId, StemmaError, StemmaRepository}

import java.time.format.DateTimeFormatter

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

  private val types = new {
    val person = "person"
    val family = "family"
  }
  private val relations = new {
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
      .hasLabel(types.person)
      .has(keys.name, request.name)
      .headOption()
      .map(_.id().toString)
      .getOrElse {
        val newVertex = graph + (types.person, nameProps +: generationProps +: (birthDateProps ++ deathDateProps): _*)
        newVertex.id().toString
      }
  }

  override def removePerson(id: String): Either[NoSuchPersonId, Unit] = {
    val person = graph.V(id).headOption()
    if (person.isEmpty) Left(NoSuchPersonId(id))
    else {
      person.foreach(_.remove())
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

  override def stemma(): Stemma = {
    val people   = graph.V.hasLabel(types.person).toCC[PersonVertex].toList().map(storedToService)
    val families = graph.V.hasLabel(types.family).toList().map(x => Family(x.id.toString))

    val spouseRelations = graph
      .E
      .hasLabel(relations.spouseOf)
      .toList()
      .map(v => Spouse(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    val childRelations = graph
      .E
      .hasLabel(relations.childOf)
      .toList()
      .map(v => Child(v.id.toString, v.outVertex().id().toString, v.inVertex().id().toString))

    Stemma(people, families, spouseRelations, childRelations)
  }

  private def storedToService(stored: PersonVertex) =
    stored
      .into[ServicePerson]
      .withFieldComputed(_.id, _.id.map(_.toString).get)
      .transform

  private def makeFamily(spouses: Vertex*) = {
    val newFamily = graph + types.family
    spouses.foreach(_ --- relations.spouseOf --> newFamily)
    newFamily.id().toString
  }

  override def newFamily(parentId: String): Either[NoSuchPersonId, String] =
    for {
      parent <- graph.V(parentId).headOption().toRight(NoSuchPersonId(parentId))
    } yield makeFamily(parent)

  override def newFamily(parent1Id: String, parent2Id: String): Either[NoSuchPersonId, String] =
    for {
      parent1 <- graph.V(parent1Id).headOption().toRight(NoSuchPersonId(parent1Id))
      parent2 <- graph.V(parent2Id).headOption().toRight(NoSuchPersonId(parent2Id))
    } yield makeFamily(parent1, parent2)

  override def removeFamily(id: String): Either[NoSuchFamilyId, Unit] = {
    for {
      family <- graph.V(id).headOption().toRight(NoSuchFamilyId(id))
      _      = family.out(relations.childOf).map(_.updateAs[PersonVertex](_.copy(generation = 0))).iterate()
    } yield family.remove()
  }

  override def addChild(familyId: String, personId: String): Either[StemmaError, Unit] =
    for {
      family           <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))
      child            <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      parentGeneration = family.in(relations.spouseOf).value(keys.generation).toList().max
      _                = child.updateAs[PersonVertex](_.copy(generation = parentGeneration + 1))
    } yield family --- relations.childOf --> child

  override def removeChild(familyId: String, personId: String): Either[StemmaError, Unit] =
    for {
      family        <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))
      child         <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      _             = child.updateAs[PersonVertex](_.copy(generation = 0))
      parentsCount  = family.inE(relations.spouseOf).count().head()
      childrenCount = family.outE(relations.childOf).count().head()
    } yield {
      family.outE(relations.childOf).where(_.otherV().hasId(personId)).drop().iterate()
      if (parentsCount == 1 && childrenCount == 1) family.remove()
    }
}
