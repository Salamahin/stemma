package io.github.salamahin.stemma.gremlin

import cats.data.EitherT
import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig.PersonVertex
import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription, PersonDefinition, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Person, Stemma}
import io.github.salamahin.stemma._

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

  private def makePerson(request: PersonDescription) = {
    val birthDateProps  = request.birthDate.map(keys.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps  = request.deathDate.map(keys.deathDate -> dateFormat.format(_)).toSeq
    val nameProps       = keys.name -> request.name
    val generationProps = keys.generation -> 0

    graph + (types.person, nameProps +: generationProps +: (birthDateProps ++ deathDateProps): _*)
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

  private def getOrCreate(person: PersonDefinition) = person match {
    case ExistingPersonId(id)           => graph.V(id).headOption().toRight(NoSuchPersonId(id))
    case description: PersonDescription => Right(makePerson(description))
  }

  override def removeFamilyIfExist(id: String): Unit = {
    ???
//    for {
//      family <- graph.V(id).headOption().toRight(NoSuchFamilyId(id))
//      _      = family.out(relations.childOf).map(_.updateAs[PersonVertex](_.copy(generation = 0))).iterate()
//    } yield family.remove()
  }

//  override def addChild(familyId: String, personId: String): Either[StemmaError, Unit] =
//    for {
//      family           <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))
//      child            <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
//      parentGeneration = family.in(relations.spouseOf).value(keys.generation).toList().max
//      _                = child.updateAs[PersonVertex](_.copy(generation = parentGeneration + 1))
//    } yield family --- relations.childOf --> child

//  override def removeChild(familyId: String, personId: String): Either[StemmaError, Unit] =
//    for {
//      family        <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))
//      child         <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
//      _             = child.updateAs[PersonVertex](_.copy(generation = 0))
//      parentsCount  = family.inE(relations.spouseOf).count().head()
//      childrenCount = family.outE(relations.childOf).count().head()
//    } yield {
//      family.outE(relations.childOf).where(_.otherV().hasId(personId)).drop().iterate()
//      if (parentsCount == 1 && childrenCount == 1) family.remove()
//    }

  override def describePerson(id: String): Either[NoSuchPersonId, PersonDescription] =
    for {
      person <- graph.V(id).toCC[PersonVertex].headOption().toRight(NoSuchPersonId(id))
    } yield person.into[PersonDescription].transform

  override def newFamily(request: FamilyDescription): Either[StemmaError, String] = {
    import cats.implicits._

    val existentFamily = (for {
      p1     <- EitherT(request.parent1.map(getOrCreate))
      p2     <- EitherT(request.parent2.map(getOrCreate))
      family <- EitherT.right(p1.outE(relations.spouseOf).otherV().where(_.inE(relations.spouseOf).otherV().is(p2)).headOption())
    } yield (p1, p2, family)).value

    val x = existentFamily
      .map {
        case err @ Left(_)      => err
        case Right((p1, p2, f)) => SuchFamilyAlreadyExist(f.id().toString, p1.id().toString, p2.id().toString)
      }

    val family  = graph + types.family
    val parents = (request.parent1 ++ request.parent2).toList

    val a = EitherT(parents.map(getOrCreate)).map(_ --- relations.spouseOf --> family).map(_ => ())
    val b = EitherT(request.children.map(getOrCreate)).map(family --- relations.childOf --> _).map(_ => ())

//    val c = a *> b
//
//    (for {
//      _ <- EitherT(parents.map(getOrCreate)).map()
//      _ <- EitherT(request.children.map(getOrCreate)).map(family --- relations.childOf --> _)
//    } yield family.id().toString).value

    ???
  }

  override def describeFamily(familyId: String): Either[NoSuchFamilyId, FamilyDescription] = ???

  override def updateFamily(id: String, request: FamilyDescription): Either[NoSuchFamilyId, Unit] = ???
}
