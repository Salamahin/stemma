package io.github.salamahin.stemma.gremlin

import gremlin.scala._
import io.github.salamahin.stemma._
import io.github.salamahin.stemma.gremlin.GraphConfig.PersonVertex
import io.github.salamahin.stemma.request.{ExtendedPersonDescription, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Person, Stemma}

import java.time.format.DateTimeFormatter

class TinkerpopStemmaRepository(graph: ScalaGraph) extends StemmaRepository {
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

  override def newFamily(): String = {
    val family = graph + types.family
    family.id().toString
  }

  override def newPerson(descr: PersonDescription): String = {
    val birthDateProps  = descr.birthDate.map(keys.birthDate -> dateFormat.format(_))
    val deathDateProps  = descr.deathDate.map(keys.deathDate -> dateFormat.format(_))
    val nameProps       = keys.name -> descr.name
    val generationProps = keys.generation -> 0

    val person = graph + (types.person, nameProps +: generationProps +: (birthDateProps ++ deathDateProps).toSeq: _*)
    person.id.toString
  }

  override def removeFamily(id: String): Either[NoSuchFamilyId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchFamilyId(id))
  override def removePerson(id: String): Either[NoSuchPersonId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchPersonId(id))

  override def describePerson(id: String): Either[NoSuchPersonId, ExtendedPersonDescription] =
    graph
      .V(id)
      .map { v =>
        val person   = v.toCC[PersonDescription]
        val spouseOf = v.outE(relations.spouseOf).otherV().map(_.id().toString).headOption()
        val childOf  = v.inE(relations.childOf).otherV().map(_.id().toString).headOption()

        ExtendedPersonDescription(person, childOf, spouseOf)
      }
      .headOption()
      .toRight(NoSuchPersonId(id))

  override def describeFamily(id: String): Either[NoSuchFamilyId, Family] =
    graph
      .V(id)
      .headOption()
      .map { f =>
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = f.outE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(f.id().toString, parents, children)
      }
      .toRight(NoSuchFamilyId(id))

  private def setRelation(familyId: String, personId: String, relation: String)(
    alreadyRelated: (String, String) => StemmaError,
    relationConflict: (String, String) => StemmaError,
    makeRelation: (Vertex, Vertex) => Unit
  ) = {
    for {
      person <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      isFamily = P.is(family)

      conflicts = person
        .bothE(relation)
        .otherV()
        .map(otherFamily =>
          if (isFamily.test(otherFamily)) alreadyRelated(familyId, personId)
          else relationConflict(otherFamily.id().toString, personId)
        )
        .toList()

      _ <- if (conflicts.isEmpty) Right() else Left(CompositeError(conflicts))

      _ = makeRelation(family, person)
    } yield ()
  }

  private def removeRelation(familyId: String, personId: String, relation: String)(
    noSuchRelation: (String, String) => StemmaError
  ) =
    for {
      person <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      _ <- person
        .bothE(relation)
        .where(_.otherV().is(family))
        .drop()
        .headOption()
        .toRight(noSuchRelation(familyId, personId))
    } yield ()

  override def setSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.spouseOf)(
      SpouseAlreadyBelongsToFamily,
      SpouseBelongsToDifferentFamily,
      (family, person) => person --- relations.spouseOf --> family
    )

  override def setChildRelation(familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.childOf)(
      ChildAlreadyBelongsToFamily,
      ChildBelongsToDifferentFamily,
      (family, person) => family --- relations.childOf --> person
    )

  override def removeChildRelation(familyId: String, personId: String): Either[StemmaError, Unit]  = removeRelation(familyId, personId, relations.childOf)(ChildDoesNotBelongToFamily)
  override def removeSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit] = removeRelation(familyId, personId, relations.spouseOf)(SpouseDoesNotBelongToFamily)

  override def stemma(): Stemma = {
    import io.scalaland.chimney.dsl._

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
}
