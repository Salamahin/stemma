package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain.{
  ChildAlreadyBelongsToFamily,
  ChildBelongsToDifferentFamily,
  ChildDoesNotBelongToFamily,
  CompositeError,
  Family,
  NoSuchFamilyId,
  NoSuchPersonId,
  Person,
  PersonDescription,
  SpouseAlreadyBelongsToFamily,
  SpouseBelongsToDifferentFamily,
  SpouseDoesNotBelongToFamily,
  Stemma,
  StemmaError
}

import java.time.LocalDate
import java.time.format.DateTimeFormatter

class StemmaRepository(graph: ScalaGraph) {
  private implicit val _graph = graph

  private val dateFormat = DateTimeFormatter.ISO_DATE

  private val keys = new {
    val name      = Key[String]("name")
    val birthDate = Key[String]("birthDate")
    val deathDate = Key[String]("deathDate")
  }

  private val types = new {
    val person = "person"
    val family = "family"
  }
  private val relations = new {
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
  }

  def newFamily(): String = {
    val family = graph + types.family
    family.id().toString
  }

  def newPerson(descr: PersonDescription): String = {
    val birthDateProps = descr.birthDate.map(keys.birthDate -> dateFormat.format(_))
    val deathDateProps = descr.deathDate.map(keys.deathDate -> dateFormat.format(_))
    val nameProps      = keys.name -> descr.name

    val person = graph + (types.person, nameProps +: (birthDateProps ++ deathDateProps).toSeq: _*)
    person.id.toString
  }

  def removeFamily(id: String): Either[NoSuchFamilyId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchFamilyId(id))
  def removePerson(id: String): Either[NoSuchPersonId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchPersonId(id))

  def describePerson(id: String): Either[NoSuchPersonId, ExtendedPersonDescription] =
    graph
      .V(id)
      .map { p =>
        val person   = p.toCC[PersonDescription]
        val spouseOf = p.outE(relations.spouseOf).otherV().map(_.id().toString).headOption()
        val childOf  = p.outE(relations.childOf).otherV().map(_.id().toString).headOption()

        ExtendedPersonDescription(person, childOf, spouseOf)
      }
      .headOption()
      .toRight(NoSuchPersonId(id))

  def describeFamily(id: String): Either[NoSuchFamilyId, Family] =
    graph
      .V(id)
      .headOption()
      .map { f =>
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = f.inE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(f.id().toString, parents, children)
      }
      .toRight(NoSuchFamilyId(id))

  private def setRelation(familyId: String, personId: String, relation: String)(
    alreadyRelated: (String, String) => StemmaError,
    relationConflict: (String, String) => StemmaError
  ) = {
    for {
      person <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      isFamily = P.is(family)

      conflicts = person
        .outE(relation)
        .otherV()
        .map(otherFamily =>
          if (isFamily.test(otherFamily)) alreadyRelated(familyId, personId)
          else relationConflict(otherFamily.id().toString, personId)
        )
        .toList()

      _ <- if (conflicts.isEmpty) Right() else Left(CompositeError(conflicts))

      _ = person --- relation --> family
    } yield ()
  }

  private def removeRelation(familyId: String, personId: String, relation: String)(
    noSuchRelation: (String, String) => StemmaError
  ) =
    for {
      person <- graph.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- graph.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      _ <- person
            .outE(relation)
            .where(_.otherV().hasId(family.id()))
            .headOption()
            .map(_.remove())
            .toRight(noSuchRelation(familyId, personId))
    } yield ()

  def setSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.spouseOf)(
      SpouseAlreadyBelongsToFamily,
      SpouseBelongsToDifferentFamily
    )

  def setChildRelation(familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.childOf)(
      ChildAlreadyBelongsToFamily,
      ChildBelongsToDifferentFamily
    )

  def removeChildRelation(familyId: String, personId: String): Either[StemmaError, Unit]  = removeRelation(familyId, personId, relations.childOf)(ChildDoesNotBelongToFamily)
  def removeSpouseRelation(familyId: String, personId: String): Either[StemmaError, Unit] = removeRelation(familyId, personId, relations.spouseOf)(SpouseDoesNotBelongToFamily)

  def stemma(): Stemma = {

    val people = graph
      .V
      .hasLabel(types.person)
      .toCC[PersonVertex]
      .map { vertex => Person(vertex.id.map(_.toString).get, vertex.name, vertex.birthDate.map(LocalDate.parse), vertex.deathDate.map(LocalDate.parse)) }
      .toList()

    val families = graph
      .V
      .hasLabel(types.family)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = family.inE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(family.id().toString, parents, children)
      }
      .toList()

    Stemma(people, families)
  }

  def updatePerson(id: String, description: PersonDescription): Either[NoSuchPersonId, Unit] = {
    for {
      person <- graph.V(id).headOption().toRight(NoSuchPersonId(id))
      _ = person.updateAs[PersonVertex](vertex =>
        vertex.copy(
          name = description.name,
          birthDate = description.birthDate.map(_.toString),
          deathDate = description.deathDate.map(_.toString)
        )
      )
    } yield ()
  }
}
