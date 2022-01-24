package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain._

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

  def newFamily(): Long = {
    val family = graph + types.family
    family.id().toString.toLong
  }

  def newPerson(descr: PersonDescription): Long = {
    val birthDateProps = descr.birthDate.map(keys.birthDate -> dateFormat.format(_))
    val deathDateProps = descr.deathDate.map(keys.deathDate -> dateFormat.format(_))
    val nameProps      = keys.name -> descr.name

    val person = graph + (types.person, nameProps +: (birthDateProps ++ deathDateProps).toSeq: _*)
    person.id.toString.toLong
  }

  def removeFamily(id: Long): Either[NoSuchFamilyId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchFamilyId(id))
  def removePerson(id: Long): Either[NoSuchPersonId, Unit] = graph.V(id).headOption().map(_.remove()).toRight(NoSuchPersonId(id))

  def describePerson(id: Long): Either[NoSuchPersonId, ExtendedPersonDescription] = {
    graph
      .V(id)
      .headOption()
      .map { p =>
        val person   = p.toCC[PersonVertex]
        val spouseOf = p.outE(relations.spouseOf).otherV().map(_.id().toString.toLong).headOption()
        val childOf  = p.outE(relations.childOf).otherV().map(_.id().toString.toLong).headOption()

        val personDescr = PersonDescription(
          person.name,
          person.birthDate.map(LocalDate.parse),
          person.deathDate.map(LocalDate.parse)
        )

        ExtendedPersonDescription(personDescr, childOf, spouseOf)
      }
      .toRight(NoSuchPersonId(id))
  }

  def describeFamily(id: Long): Either[NoSuchFamilyId, Family] =
    graph
      .V(id)
      .headOption()
      .map { f =>
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString.toLong).toList()
        val children = f.inE(relations.childOf).otherV().id().map(_.toString.toLong).toList()

        Family(f.id().toString.toLong, parents, children)
      }
      .toRight(NoSuchFamilyId(id))

  private def setRelation(familyId: Long, personId: Long, relation: String)(
    alreadyRelated: (Long, Long) => StemmaError,
    relationConflict: (Long, Long) => StemmaError
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
          else relationConflict(otherFamily.id().toString.toLong, personId)
        )
        .toList()

      _ <- if (conflicts.isEmpty) Right() else Left(CompositeError(conflicts))

      _ = person --- relation --> family
    } yield ()
  }

  private def removeRelation(familyId: Long, personId: Long, relation: String)(
    noSuchRelation: (Long, Long) => StemmaError
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

  def setSpouseRelation(familyId: Long, personId: Long): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.spouseOf)(
      SpouseAlreadyBelongsToFamily,
      SpouseBelongsToDifferentFamily
    )

  def setChildRelation(familyId: Long, personId: Long): Either[StemmaError, Unit] =
    setRelation(familyId, personId, relations.childOf)(
      ChildAlreadyBelongsToFamily,
      ChildBelongsToDifferentFamily
    )

  def removeChildRelation(familyId: Long, personId: Long): Either[StemmaError, Unit]  = removeRelation(familyId, personId, relations.childOf)(ChildDoesNotBelongToFamily)
  def removeSpouseRelation(familyId: Long, personId: Long): Either[StemmaError, Unit] = removeRelation(familyId, personId, relations.spouseOf)(SpouseDoesNotBelongToFamily)

  def stemma(): Stemma = {
    val people = graph
      .V
      .hasLabel(types.person)
      .toCC[PersonVertex]
      .map { vertex => {
        Person(vertex.id.get, vertex.name, vertex.birthDate.map(LocalDate.parse), vertex.deathDate.map(LocalDate.parse))
      } }
      .toList()

    val families = graph
      .V
      .hasLabel(types.family)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString.toLong).toList()
        val children = family.inE(relations.childOf).otherV().id().map(_.toString.toLong).toList()

        Family(family.id().toString.toLong, parents, children)
      }
      .toList()

    Stemma(people, families)
  }

  def updatePerson(id: Long, description: PersonDescription): Either[NoSuchPersonId, Unit] = {
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
