package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaOperations._

import java.time.LocalDate
import java.time.format.DateTimeFormatter

class StemmaOperations {
  def listGraphs(ts: TraversalSource, ownerId: String): Either[UnknownUser, List[GraphDescription]] =
    for {
      owner <- ts.V(ownerId).headOption().toRight(UnknownUser(ownerId))
      graphs = owner
        .outE(relations.ownerOf)
        .otherV()
        .where(_.hasLabel(types.graph))
        .map { v => GraphDescription(v.id().toString, v.property(Key[String]("description")).value()) }
        .toList()
    } yield graphs

  def stemma(ts: TraversalSource, graphId: String): Stemma = {
    val people = ts
      .V()
      .hasLabel(types.person)
      .has(Key[String]("graphId"), graphId)
      .toCC[PersonVertex]
      .map { vertex => Person(vertex.id.get.toString, vertex.name, vertex.birthDate.map(LocalDate.parse), vertex.deathDate.map(LocalDate.parse)) }
      .toList()

    val families = ts
      .V()
      .hasLabel(types.family)
      .has(Key[String]("graphId"), graphId)
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

  def newFamily(ts: TraversalSource, graphId: String): String = {
    val family = ts.addV(types.family).head()
    family.property("graph", graphId)
    family.id().toString
  }

  def getOrCreateUser(ts: TraversalSource, email: String): User = {
    val userId = ts
      .V()
      .hasLabel(types.user)
      .has(Key[String]("email"), email)
      .headOption()
      .getOrElse {
        val newUser = ts.addV(types.user).head()
        newUser.property("email", email)
        newUser
      }
      .id()
      .toString

    User(userId, email)
  }

  def changeOwner(ts: TraversalSource, startPersonId: String, newOwnerId: String): Either[UnknownUser, Unit] = {
    for {
      newOwner <- ts.V(newOwnerId).headOption().toRight(UnknownUser(newOwnerId))
      _ = ts
        .V(startPersonId)
        .outE(relations.spouseOf)
        .otherV()
        .repeat(_.outE(relations.spouseOf, relations.childOf).otherV())
        .emit()
        .map { family =>
          family.inE(relations.ownerOf).drop().head()
          newOwner.addEdge(relations.ownerOf, family)
          family
        }
        .repeat(_.inE(relations.spouseOf, relations.childOf).otherV())
        .emit()
        .map { person =>
          person.inE(relations.ownerOf).drop().head()
          newOwner.addEdge(relations.ownerOf, person)
        }
        .iterate()
    } yield ()

  }

  def newGraph(ts: TraversalSource, description: String) = {
    val graph = ts.addV(types.graph).head()
    graph.property("description", description)
    graph.id().toString
  }

  def removeChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    removeRelation(ts, familyId, personId, relations.childOf)(ChildDoesNotBelongToFamily)

  def removeSpouseRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    removeRelation(ts, familyId, personId, relations.spouseOf)(SpouseDoesNotBelongToFamily)

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

  def newPerson(ts: TraversalSource, graphId: String, descr: PersonDescription): String = {
    val personVertex = ts.addV(types.person).head()

    personVertex.property("name", descr.name)
    personVertex.property("graphId", graphId)
    descr.birthDate.map(dateFormat.format(_)) foreach (personVertex.property("birthDate", _))
    descr.deathDate.map(dateFormat.format(_)) foreach (personVertex.property("deathDate", _))

    personVertex.id().toString
  }

  def makeSpouseRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, familyId, personId, relations.spouseOf)(
      NoSuchPersonId,
      NoSuchFamilyId,
      (fid, pid) => Left(SpouseAlreadyBelongsToFamily(fid, pid)),
      (fid, pid) => Left(SpouseBelongsToDifferentFamily(fid, pid))
    )

  private def setRelation(ts: TraversalSource, from: String, to: String, relation: String)(
    sourceNotFound: String => StemmaError,
    targetNotFound: String => StemmaError,
    alreadyRelated: (String, String) => Either[StemmaError, Unit],
    relationConflict: (String, String) => Either[StemmaError, Unit]
  ) = {
    for {
      toV   <- ts.V(to).headOption().toRight(targetNotFound(from))
      fromV <- ts.V(from).headOption().toRight(sourceNotFound(to))

      areRelated = P.is(fromV)

      _ <- toV
            .outE(relation)
            .otherV()
            .headOption()
            .map(relation =>
              if (areRelated.test(relation)) alreadyRelated(from, to)
              else relationConflict(relation.id().toString, to)
            )
            .getOrElse(Right((): Unit))

      _ = ts.addE(relation).from(toV).to(fromV).head()
    } yield ()
  }

  def makeChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, familyId, personId, relations.childOf)(
      NoSuchPersonId,
      NoSuchFamilyId,
      (fid, pid) => Left(ChildAlreadyBelongsToFamily(fid, pid)),
      (fid, pid) => Left(ChildBelongsToDifferentFamily(fid, pid))
    )

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

  private def isOwnerOf(ts: TraversalSource, userId: String, resourceId: String)(resourceNotFound: String => StemmaError) =
    for {
      user     <- ts.V(userId).headOption().toRight(UnknownUser(userId))
      resource <- ts.V(resourceId).headOption().toRight(resourceNotFound(resourceId))
      isOwner  = user.outE(relations.ownerOf).where(_.otherV().is(resource)).headOption().isDefined
    } yield isOwner

  def isOwnerOfFamily(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, familyId)(NoSuchFamilyId)

  def isOwnerOfPerson(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, personId)(NoSuchFamilyId)

  def isOwnerOfGraph(ts: TraversalSource, userId: String, graphId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, graphId)(NoSuchFamilyId)

  def makeFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, familyId, relations.ownerOf)(
      UnknownUser,
      NoSuchFamilyId,
      (userId, _) => Left(UserIsAlreadyFamilyOwner(userId)),
      (userId, _) => Left(FamilyIsOwnedByDifferentUser(userId))
    )

  def makePersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, personId, relations.ownerOf)(
      UnknownUser,
      NoSuchPersonId,
      (userId, _) => Left(UserIsAlreadyPersonOwner(userId)),
      (userId, _) => Left(PersonIsOwnedByDifferentUser(userId))
    )

  def makeGraphOwner(ts: TraversalSource, userId: String, graphId: String) = setRelation(ts, userId, graphId, relations.ownerOf)(
    UnknownUser,
    NoSuchPersonId,
    (familyId, _) => Left(UserIsAlreadyPersonOwner(familyId)),
    (_, _) => Right()
  )
}

private object StemmaOperations {
  val dateFormat = DateTimeFormatter.ISO_DATE

  object types {
    val person = "person"
    val family = "family"
    val user   = "user"
    val graph  = "graph"
  }

  object relations {
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
    val ownerOf  = "ownerOf"
  }
}
