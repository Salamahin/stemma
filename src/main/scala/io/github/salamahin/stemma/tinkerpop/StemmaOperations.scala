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
      .map { vertex =>
        val name      = vertex.property(Key[String]("name")).value()
        val birthDate = vertex.property(Key[String]("birthDate")).toOption.map(LocalDate.parse)
        val deathDate = vertex.property(Key[String]("deathDate")).toOption.map(LocalDate.parse)

        Person(vertex.id().toString, name, birthDate, deathDate)
      }
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
      _      = person.property("name", description.name)
      _      = description.birthDate.map(_.toString).foreach(person.property("birthDate", _))
      _      = description.deathDate.map(_.toString).foreach(person.property("deathDate", _))
    } yield ()
  }

  def newFamily(ts: TraversalSource, graphId: String): String = {
    val family = ts.addV(types.family).head()
    family.property("graphId", graphId)
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

  def newGraph(ts: TraversalSource, description: String): String = {
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
    setRelation(ts, personId, familyId, relations.spouseOf)(
      NoSuchPersonId(personId),
      NoSuchFamilyId(familyId)
    )

  private def setRelation(ts: TraversalSource, from: String, to: String, relation: String)(
    sourceNotFound: => StemmaError,
    targetNotFound: => StemmaError,
    checks: RelationRules*
  ) = {
    import cats.syntax.traverse._
    for {
      fromV <- ts.V(from).headOption().toRight(sourceNotFound)
      toV   <- ts.V(to).headOption().toRight(targetNotFound)
      x     <- checks.toList.map(_.between(fromV, toV)).sequence
      _     = ts.addE(relation).from(fromV).to(toV).iterate()
    } yield ()
  }

  def makeChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, personId, familyId, relations.childOf)(
      NoSuchPersonId(personId),
      NoSuchFamilyId(familyId),
      childShouldBelongToSingleFamily
    )

  def removeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, Unit] = ts.V(id).headOption().map(_.remove()).toRight(NoSuchFamilyId(id))

  def removePerson(ts: TraversalSource, id: String): Either[NoSuchPersonId, Unit] = ts.V(id).headOption().map(_.remove()).toRight(NoSuchPersonId(id))

  def describePerson(ts: TraversalSource, id: String): Either[NoSuchPersonId, ExtendedPersonDescription] = {
    ts.V(id)
      .headOption()
      .map { p =>
        val spouseOf = p.outE(relations.spouseOf).otherV().map(_.id().toString).headOption()
        val childOf  = p.outE(relations.childOf).otherV().map(_.id().toString).headOption()

        val personDescr = PersonDescription(
          p.property(Key[String]("name")).value(),
          p.property(Key[String]("birthDate")).toOption.map(LocalDate.parse),
          p.property(Key[String]("deathDate")).toOption.map(LocalDate.parse)
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
      UnknownUser(userId),
      NoSuchFamilyId(familyId),
      thereAreNoOtherOwners(FamilyIsOwnedByDifferentUser(familyId))
    )

  def makePersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, personId, relations.ownerOf)(
      UnknownUser(userId),
      NoSuchPersonId(personId),
      thereAreNoOtherOwners(PersonIsOwnedByDifferentUser(personId))
    )

  def makeGraphOwner(ts: TraversalSource, userId: String, graphId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, graphId, relations.ownerOf)(
      UnknownUser(userId),
      NoSuchGraphId(graphId)
    )
}

private object StemmaOperations {
  trait RelationRules {
    def between(from: Vertex, to: Vertex): Either[StemmaError, Unit]
  }

  val childShouldBelongToSingleFamily: RelationRules = (child: Vertex, family: Vertex) => {
    child
      .outE(relations.childOf)
      .where(_.otherV().is(P.neq(family)))
      .otherV()
      .map(otherFamily => Left(ChildAlreadyBelongsToFamily(otherFamily.id().toString, child.id().toString)))
      .headOption()
      .getOrElse(Right((): Unit))
  }

  def thereAreNoOtherOwners(err: => StemmaError): RelationRules = (source: Vertex, target: Vertex) => {
    target
      .inE(relations.ownerOf)
      .where(_.otherV().is(P.neq(source)))
      .headOption()
      .map(_ => Left(err))
      .getOrElse(Right((): Unit))
  }

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
