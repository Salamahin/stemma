package io.github.salamahin.stemma.tinkerpop

import com.typesafe.scalalogging.LazyLogging
import gremlin.scala._
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaRepository._

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import scala.collection.mutable

class StemmaRepository extends LazyLogging {
  def listStemmas(ts: TraversalSource, ownerId: String): Either[UnknownUser, List[StemmaDescription]] =
    for {
      owner <- ts.V(ownerId).headOption().toRight(UnknownUser(ownerId))
      stemmas = owner
        .outE(relations.ownerOf)
        .otherV()
        .where(_.hasLabel(types.stemma))
        .map { v => StemmaDescription(v.id().toString, v.property(stemmaKeys.name).value()) }
        .toList()
    } yield stemmas

  def stemma(ts: TraversalSource, stemmaId: String): Stemma = {
    val people = ts
      .V()
      .hasLabel(types.person)
      .has(keys.stemmaId, stemmaId)
      .map { vertex =>
        val name      = vertex.property(personKeys.name).value()
        val birthDate = vertex.property(personKeys.birthDate).toOption.map(LocalDate.parse)
        val deathDate = vertex.property(personKeys.deathDate).toOption.map(LocalDate.parse)

        PersonDescription(vertex.id().toString, name, birthDate, deathDate)
      }
      .toList()

    val families = ts
      .V()
      .hasLabel(types.family)
      .has(keys.stemmaId, stemmaId)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = family.inE(relations.childOf).otherV().id().map(_.toString).toList()

        FamilyDescription(family.id().toString, parents, children)
      }
      .toList()

    Stemma(people, families)
  }

  def updatePerson(ts: TraversalSource, id: String, description: CreateNewPerson): Either[NoSuchPersonId, Unit] = {
    for {
      person <- ts.V(id).headOption().toRight(NoSuchPersonId(id))
      _      = person.setProperty(personKeys.name, description.name)
      _      = description.birthDate.map(_.toString).foreach(person.setProperty(personKeys.birthDate, _))
      _      = description.deathDate.map(_.toString).foreach(person.setProperty(personKeys.deathDate, _))
    } yield ()
  }

  def newFamily(ts: TraversalSource, stemmaId: String): String = {
    val family = ts.addV(types.family).head()
    family.setProperty(keys.stemmaId, stemmaId)
    family.id().toString
  }

  def getOrCreateUser(ts: TraversalSource, email: Email): User = {
    val userId = ts
      .V()
      .hasLabel(types.user)
      .has(userKeys.email, email.email)
      .headOption()
      .getOrElse {
        logger.debug(s"User with email $email is not found, creating a new one")
        val newUser = ts.addV(types.user).head()
        newUser.setProperty(userKeys.email, email.email)
        newUser
      }
      .id()
      .toString

    logger.debug(s"User email $email is associated with id $userId")
    User(userId, email)
  }

  def listChownEffect(ts: TraversalSource, startPersonId: String, newOwnerId: String): Either[UnknownUser, ChownEffect] = {
    val newOwner = ts.V(newOwnerId).headOption().toRight(UnknownUser(newOwnerId))

    newOwner
      .map { _ =>
        val familyIds = mutable.Set.empty[String]
        val personIds = mutable.Set.empty[String]

        ts.V(startPersonId)
          .outE(relations.spouseOf)
          .otherV()
          .sideEffect(family => familyIds += family.id().toString)
          .repeat { family =>
            val membersOfFamily = family
              .inE(relations.spouseOf, relations.childOf)
              .outV()
              .sideEffect(person => personIds += person.id().toString)
              .dedup()

            membersOfFamily
              .outE(relations.spouseOf, relations.childOf)
              .inV()
              .simplePath()
              .sideEffect(family => familyIds += family.id().toString)
          }
          .iterate()

        ChownEffect(familyIds.toList, personIds.toList)
      }
  }

  def newStemma(ts: TraversalSource, name: String): String = {
    val graph = ts.addV(types.stemma).head()
    graph.setProperty(stemmaKeys.name, name)
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

  def newPerson(ts: TraversalSource, stemmaId: String, descr: CreateNewPerson): String = {
    val personVertex = ts.addV(types.person).head()

    personVertex.setProperty(personKeys.name, descr.name)
    personVertex.setProperty(keys.stemmaId, stemmaId)
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
        val stemmaId = p.property(keys.stemmaId).value()

        val personDescr = CreateNewPerson(
          p.property(personKeys.name).value(),
          p.property(personKeys.birthDate).toOption.map(LocalDate.parse),
          p.property(personKeys.deathDate).toOption.map(LocalDate.parse)
        )

        ExtendedPersonDescription(personDescr, childOf, spouseOf, stemmaId, ownerId)
      }
      .toRight(NoSuchPersonId(id))
  }

  def describeFamily(ts: TraversalSource, id: String): Either[NoSuchFamilyId, ExtendedFamilyDescription] =
    ts.V(id)
      .headOption()
      .map { f =>
        val stemmaId = f.property(keys.stemmaId).value()
        val parents  = f.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = f.inE(relations.childOf).otherV().id().map(_.toString).toList()

        ExtendedFamilyDescription(FamilyDescription(f.id().toString, parents, children), stemmaId)
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

  def isStemmaOwner(ts: TraversalSource, userId: String, stemmaId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, stemmaId)(NoSuchFamilyId)

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

  def makeGraphOwner(ts: TraversalSource, userId: String, stemmaId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, stemmaId, relations.ownerOf)(
      UnknownUser(userId),
      NoSuchStemmaId(stemmaId)
    )

  private def removeOwnership(ts: TraversalSource, userId: String, targetId: String)(err: => StemmaError) =
    for {
      person <- ts.V(targetId).headOption().toRight(err)
      user   <- ts.V(userId).headOption().toRight(UnknownUser(userId))
      _      = person.inE(relations.ownerOf).drop().iterate()
      _      = ts.addE(relations.ownerOf).from(user).to(person).head()
    } yield ()

  def resetPersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Unit] =
    removeOwnership(ts, userId, personId)(NoSuchPersonId(personId))

  def resetFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Unit] =
    removeOwnership(ts, userId, familyId)(NoSuchFamilyId(familyId))
}

private object StemmaRepository {
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
    val stemmaId: Key[String] = Key[String]("stemmaId")
  }

  object personKeys {
    val name: Key[String]      = Key[String]("name")
    val birthDate: Key[String] = Key[String]("birthDate")
    val deathDate: Key[String] = Key[String]("deathDate")
  }

  object userKeys {
    val email: Key[String] = Key[String]("email")
  }

  object stemmaKeys {
    val name: Key[String] = Key[String]("name")
  }

  object types {
    val person = "person"
    val family = "family"
    val user   = "user"
    val stemma = "stemma"
  }

  object relations {
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
    val ownerOf  = "ownerOf"
  }
}