package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaOperations._

import java.time.LocalDate
import java.time.format.DateTimeFormatter

class StemmaOperations {
  private val dateFormat = DateTimeFormatter.ISO_DATE

  def newFamily(ts: TraversalSource): String = {
    val family = ts.addV(types.family).head()
    family.id().toString
  }

  def newPerson(ts: TraversalSource, descr: PersonDescription): String = {
    val personVertex = ts.addV(types.person).head()

    personVertex.property("name", descr.name)
    descr.birthDate.map(dateFormat.format(_)) foreach (personVertex.property("birthDate", _))
    descr.deathDate.map(dateFormat.format(_)) foreach (personVertex.property("deathDate", _))

    personVertex.id().toString
  }

  def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = ts.V(id).headOption().map(_.remove()).toRight(NoSuchFamilyId(id))
  def removePerson(ts: TraversalSource, id: String): Either[NoSuchPersonId, Unit] = ts.V(id).headOption().map(_.remove()).toRight(NoSuchPersonId(id))

  def describePerson(ts: TraversalSource, id: String): Either[NoSuchPersonId, ExtendedPersonDescription] = {
    ts.V(id)
      .headOption()
      .map { p =>
        val person   = p.toCC[PersonVertex]
        val spouseOf = p.outE(relations.spouseOf).otherV().map(_.id().toString).headOption()
        val childOf  = p.outE(relations.childOf).otherV().map(_.id().toString).headOption()

        val personDescr = PersonDescription(
          person.name,
          person.birthDate.map(LocalDate.parse),
          person.deathDate.map(LocalDate.parse)
        )

        ExtendedPersonDescription(personDescr, childOf, spouseOf)
      }
      .toRight(NoSuchPersonId(id))
  }

  def describeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Family] =
    ts.V(id)
      .headOption()
      .map { f =>
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = f.inE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(f.id().toString, parents, children)
      }
      .toRight(NoSuchFamilyId(id))

  private def setRelation(ts: TraversalSource, familyId: String, personId: String, relation: String)(
    alreadyRelated: (String, String) => StemmaError,
    relationConflict: (String, String) => StemmaError
  ) = {
    for {
      person <- ts.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- ts.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      isFamily = P.is(family)

      conflicts = person
        .outE(relation)
        .otherV()
        .map(otherFamily =>
          if (isFamily.test(otherFamily)) alreadyRelated(familyId, personId)
          else relationConflict(otherFamily.id().toString, personId)
        )
        .toList()

      _ <- if (conflicts.isEmpty) Right((): Unit) else Left(CompositeError(conflicts))

      _ = ts.addE(relation).from(person).to(family).head()
    } yield ()
  }

  private def removeRelation(ts: TraversalSource, familyId: String, personId: String, relation: String)(
    noSuchRelation: (String, String) => StemmaError
  ) =
    for {
      person <- ts.V(personId).headOption().toRight(NoSuchPersonId(personId))
      family <- ts.V(familyId).headOption().toRight(NoSuchFamilyId(familyId))

      _ <- person
            .outE(relation)
            .where(_.otherV().hasId(family.id()))
            .headOption()
            .map(_.remove())
            .toRight(noSuchRelation(familyId, personId))
    } yield ()

  def setSpouseRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, familyId, personId, relations.spouseOf)(
      SpouseAlreadyBelongsToFamily,
      SpouseBelongsToDifferentFamily
    )

  def setChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, familyId, personId, relations.childOf)(
      ChildAlreadyBelongsToFamily,
      ChildBelongsToDifferentFamily
    )

  def removeChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit]  = removeRelation(ts, familyId, personId, relations.childOf)(ChildDoesNotBelongToFamily)
  def removeSpouseRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] = removeRelation(ts, familyId, personId, relations.spouseOf)(SpouseDoesNotBelongToFamily)

  def stemma(ts: TraversalSource): Stemma = {
    val people = ts
      .V()
      .hasLabel(types.person)
      .toCC[PersonVertex]
      .map { vertex => Person(vertex.id.get.toString, vertex.name, vertex.birthDate.map(LocalDate.parse), vertex.deathDate.map(LocalDate.parse)) }
      .toList()

    val families = ts
      .V()
      .hasLabel(types.family)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = family.inE(relations.childOf).otherV().id().map(_.toString).toList()

        Family(family.id().toString, parents, children)
      }
      .toList()

    Stemma(people, families)
  }

  def updatePerson(ts: TraversalSource, id: String, description: PersonDescription): Either[NoSuchPersonId, Unit] = {
    for {
      person <- ts.V(id).headOption().toRight(NoSuchPersonId(id))
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

private object StemmaOperations {
  object keys {
    val name      = Key[String]("name")
    val birthDate = Key[String]("birthDate")
    val deathDate = Key[String]("deathDate")
  }

  object types {
    val person = "person"
    val family = "family"
  }

  object relations {
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
  }
}
