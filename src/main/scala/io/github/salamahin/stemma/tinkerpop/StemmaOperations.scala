package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaOperations._

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import scala.collection.mutable.ArrayBuffer

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
      .has(keys.graphId, graphId)
      .map { vertex =>
        val name      = vertex.property(personKeys.name).value()
        val birthDate = vertex.property(personKeys.birthDate).toOption.map(LocalDate.parse)
        val deathDate = vertex.property(personKeys.deathDate).toOption.map(LocalDate.parse)

        Person(vertex.id().toString, name, birthDate, deathDate)
      }
      .toList()

    val families = ts
      .V()
      .hasLabel(types.family)
      .has(keys.graphId, graphId)
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
      _      = person.setProperty(personKeys.name, description.name)
      _      = description.birthDate.map(_.toString).foreach(person.setProperty(personKeys.birthDate, _))
      _      = description.deathDate.map(_.toString).foreach(person.setProperty(personKeys.deathDate, _))
    } yield ()
  }

  def newFamily(ts: TraversalSource, graphId: String): String = {
    val family = ts.addV(types.family).head()
    family.setProperty(keys.graphId, graphId)
    family.id().toString
  }

  def getOrCreateUser(ts: TraversalSource, email: String): User = {
    val userId = ts
      .V()
      .hasLabel(types.user)
      .has(userKeys.email, email)
      .headOption()
      .getOrElse {
        val newUser = ts.addV(types.user).head()
        newUser.setProperty(userKeys.email, email)
        newUser
      }
      .id()
      .toString

    User(userId, email)
  }

  def listChownEffect(ts: TraversalSource, startPersonId: String, newOwnerId: String): Either[UnknownUser, ChownEffect] = {
    val newOwner = ts.V(newOwnerId).headOption().toRight(UnknownUser(newOwnerId))

    newOwner
      .map { _ =>
        val familyIds = ArrayBuffer.empty[String]
        val personIds = ArrayBuffer.empty[String]

        val ssss = ts.V(startPersonId)
          .outE(relations.spouseOf)
          .otherV()
          .repeat { family =>

            val membersOfFamily = family
              .inE(relations.spouseOf, relations.childOf)
              .outV()
              .sideEffect(person => {
                personIds += person.id().toString
              })

            val otherFamilies =
              membersOfFamily
                .outE(relations.spouseOf, relations.childOf)
                .inV()
                .sideEffect(family => {
                  familyIds += family.id().toString
                })

            otherFamilies.dedup()
          }
          .path()

        println(ssss.head())

        ChownEffect(familyIds.toList, personIds.toList)
      }
  }

  def newGraph(ts: TraversalSource, description: String): String = {
    val graph = ts.addV(types.graph).head()
    graph.setProperty(graphKeys.description, description)
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

    personVertex.setProperty(personKeys.name, descr.name)
    personVertex.setProperty(keys.graphId, graphId)
    descr.birthDate.map(dateFormat.format(_)) foreach (personVertex.setProperty(personKeys.birthDate, _))
    descr.deathDate.map(dateFormat.format(_)) foreach (personVertex.setProperty(personKeys.deathDate, _))

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
      _     <- checks.toList.map(_.between(fromV, toV)).sequence
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
        val spouseOf = p.outE(relations.spouseOf).otherV().map(_.id().toString).toList()
        val childOf  = p.outE(relations.childOf).otherV().map(_.id().toString).headOption()
        val ownerId  = p.inE(relations.ownerOf).otherV().map(_.id().toString).head()
        val graphId  = p.property(keys.graphId).value()

        val personDescr = PersonDescription(
          p.property(personKeys.name).value(),
          p.property(personKeys.birthDate).toOption.map(LocalDate.parse),
          p.property(personKeys.deathDate).toOption.map(LocalDate.parse)
        )

        ExtendedPersonDescription(personDescr, childOf, spouseOf, graphId, ownerId)
      }
      .toRight(NoSuchPersonId(id))
  }

  def describeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, ExtendedFamilyDescription] =
    ts.V(id)
      .headOption()
      .map { f =>
        val graphId  = f.property(keys.graphId).value()
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = f.inE(relations.childOf).otherV().id().map(_.toString).toList()

        ExtendedFamilyDescription(Family(f.id().toString, parents, children), graphId)
      }
      .toRight(NoSuchFamilyId(id))

  private def isOwnerOf(ts: TraversalSource, userId: String, resourceId: String)(resourceNotFound: String => StemmaError) =
    for {
      user     <- ts.V(userId).headOption().toRight(UnknownUser(userId))
      resource <- ts.V(resourceId).headOption().toRight(resourceNotFound(resourceId))
      isOwner  = user.outE(relations.ownerOf).where(_.otherV().is(resource)).headOption().isDefined
    } yield isOwner

  def isFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, familyId)(NoSuchFamilyId)

  def isPersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, personId)(NoSuchFamilyId)

  def isGraphOwner(ts: TraversalSource, userId: String, graphId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, graphId)(NoSuchFamilyId)

  def makeFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, familyId, relations.ownerOf)(
      UnknownUser(userId),
      NoSuchFamilyId(familyId),
      thereAreNoOtherOwners(AccessToFamilyDenied(familyId))
    )

  def makePersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, personId, relations.ownerOf)(
      UnknownUser(userId),
      NoSuchPersonId(personId),
      thereAreNoOtherOwners(AccessToPersonDenied(personId))
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

  object keys {
    val graphId: Key[String] = Key[String]("graphId")
  }

  object personKeys {
    val name: Key[String]      = Key[String]("name")
    val birthDate: Key[String] = Key[String]("birthDate")
    val deathDate: Key[String] = Key[String]("deathDate")
  }

  object userKeys {
    val email: Key[String] = Key[String]("email")
  }

  object graphKeys {
    val description: Key[String] = Key[String]("description")
  }

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
