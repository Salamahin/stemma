package io.github.salamahin.stemma.gremlin

import cats.data.EitherT
import gremlin.scala._
import io.github.salamahin.stemma._
import io.github.salamahin.stemma.gremlin.GraphConfig.PersonVertex
import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription, PersonDefinition, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Person, Stemma}
import io.scalaland.chimney.dsl._

import java.time.format.DateTimeFormatter

class GremlinBasedStemmaRepository(graph: ScalaGraph) extends StemmaRepository {
  private implicit val _graph = graph

  import cats.syntax.alternative._

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

  private def makePerson(request: PersonDescription) = {
    val birthDateProps  = request.birthDate.map(keys.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps  = request.deathDate.map(keys.deathDate -> dateFormat.format(_)).toSeq
    val nameProps       = keys.name -> request.name
    val generationProps = keys.generation -> 0

    graph + (types.person, nameProps +: generationProps +: (birthDateProps ++ deathDateProps): _*)
  }

  private def getOrCreate(person: PersonDefinition) = person match {
    case ExistingPersonId(id)           => graph.V(id).headOption().toRight(NoSuchPersonId(id))
    case description: PersonDescription => Right(makePerson(description))
  }

  private def checkAlreadyMarried(parent1: Vertex, parent2: Vertex): Either[StemmaError, Unit] =
    parent1.outE(relations.spouseOf).otherV().where(_.inE(relations.spouseOf).otherV().is(parent2)).headOption() match {
      case None         => Right()
      case Some(family) => Left(SuchFamilyAlreadyExist(family.id().toString, parent1.id().toString, parent2.id().toString))
    }

  private def checkIfChildBelongsToDifferentFamily(person: Vertex): Either[StemmaError, Unit] =
    person.inE(relations.childOf).otherV().headOption() match {
      case None         => Right()
      case Some(family) => Left(ChildBelongsToDifferentFamily(person.id().toString, family.id().toString))
    }

  override def newPerson(request: PersonDescription): String =
    makePerson(request).id().toString

  override def removePersonIfExist(id: String): Unit =
    graph.V(id).headOption().foreach(_.remove())

  override def updatePerson(id: String, request: PersonDescription): Either[NoSuchPersonId, Unit] = {
    graph
      .V(id)
      .headOption()
      .map(_.updateAs[PersonVertex](vertex => vertex.copy(name = request.name, birthDate = request.birthDate, deathDate = request.deathDate)))
      .map(_ => Right())
      .getOrElse(Left(NoSuchPersonId(id)))
  }

  override def stemma(): Stemma = {
    val people = graph
      .V
      .hasLabel(types.person)
      .toCC[PersonVertex]
      .map { person => person.into[Person].withFieldComputed(_.id, _.id.map(_.toString).get).transform }
      .toList()

    val families = graph
      .V
      .hasLabel(types.family)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = family.outE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(family.id().toString, parents, children)
      }
      .toList()

    Stemma(people, families)
  }

  override def removeFamilyIfExist(id: String): Unit = {
    ???
  }

  override def describePerson(id: String): Either[NoSuchPersonId, PersonDescription] =
    for {
      person <- graph.V(id).toCC[PersonVertex].headOption().toRight(NoSuchPersonId(id))
    } yield person.into[PersonDescription].transform

  override def newFamily(request: FamilyDescription): Either[StemmaError, String] = {
    if ((request.parent1 ++ request.parent2 ++ request.children).size <= 1) Left(IncompleteFamily())
    else {
      val family = graph + types.family

      val createdParents = (for {
        parent <- EitherT[List, StemmaError, Vertex]((request.parent1 ++ request.parent2).toList.map(getOrCreate))
      } yield parent).value

      val (_, parents) = createdParents.separate
      val checkedMarriage = parents match {
        case p1 :: p2 :: Nil => checkAlreadyMarried(p1, p2)
        case _               => Right()
      }
      parents.foreach(_ --- relations.spouseOf --> family)

      val createdChildren = (for {
        child <- EitherT[List, StemmaError, Vertex](request.children.map(getOrCreate))
        _     <- EitherT(checkIfChildBelongsToDifferentFamily(child) :: Nil)
      } yield family --- relations.childOf --> child).value

      val (lefts, _) = (createdParents ++ createdChildren :+ checkedMarriage).separate
      if (lefts.isEmpty) Right(family.id().toString) else Left(CompositeError(lefts))
    }
  }

  override def describeFamily(familyId: String): Either[NoSuchFamilyId, FamilyDescription] = ???

  override def updateFamily(id: String, request: FamilyDescription): Either[StemmaError, Unit] = {
    def separateNewAndExistent(people: List[PersonDefinition]) = people.partition {
      case ExistingPersonId(_) => true
      case _                   => false
    }

    def updateRelation(family: EitherT[List, StemmaError, Vertex], actors: EitherT[List, StemmaError, Vertex])(func: (Vertex, Vertex) => Unit) =
      (for {
        f <- family
        v <- actors.map { a => func(f, a); a }
      } yield v).value

    val family = EitherT.fromEither[List](graph.V(id).headOption().toRight[StemmaError](NoSuchFamilyId(id)))

    family.map(_.inE(relations.spouseOf).drop().iterate())
    family.map(_.outE(relations.childOf).drop().iterate())

    val (existingParents, newParents)   = separateNewAndExistent((request.parent1 ++ request.parent2).toList)
    val (existingChildren, newChildren) = separateNewAndExistent(request.children)

    val parentsVertexes  = updateRelation(family, EitherT(existingParents.map(getOrCreate)))((f, p) => p.outE(relations.spouseOf).where(_.otherV() is f).drop())
    val childrenVertexes = updateRelation(family, EitherT(existingChildren.map(getOrCreate)))((f, c) => c.inE(relations.childOf).where(_.otherV() is f).drop())
    val parents          = updateRelation(family, EitherT(parentsVertexes ++ newParents.map(getOrCreate)))((f, p) => p --- relations.spouseOf --> f)
    val children         = updateRelation(family, EitherT(childrenVertexes ++ newChildren.map(getOrCreate)))((f, c) => f --- relations.childOf --> c)

    val (lefts, _) = (parents ++ children ++ family.value).separate
    if (lefts.isEmpty) Right() else Left(CompositeError(lefts))
  }
}
