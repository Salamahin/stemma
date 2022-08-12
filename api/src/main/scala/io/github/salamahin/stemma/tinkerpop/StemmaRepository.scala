package io.github.salamahin.stemma.tinkerpop

import gremlin.scala._
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop
import io.github.salamahin.stemma.tinkerpop.StemmaRepository._

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import scala.collection.mutable

class StemmaRepository {
  def listStemmas(ts: TraversalSource, ownerId: String): Either[NoSuchUserId, List[StemmaDescription]] =
    ts.V(ownerId)
      .headOption()
      .toRight(NoSuchUserId(ownerId))
      .map { owner =>
        owner
          .out(relations.ownerOf)
          .where(_.hasLabel(types.stemma))
          .map { v => StemmaDescription(v.id().toString, v.property(stemmaKeys.name).value(), thereAreNoOtherOwners(owner, v)) }
          .toList()
      }

  def removeStemma(ts: TraversalSource, stemmaId: String, userId: String): Either[StemmaError, Unit] = {
    for {
      isOwner          <- isStemmaOwner(ts, userId, stemmaId)
      stemmaV          = ts.V(stemmaId).head()
      hasNoOtherOwners = thereAreNoOtherOwners(ts.V(userId).head(), stemmaV)

      _ <- if (isOwner && hasNoOtherOwners) Right(stemmaV.remove()) else Left(IsNotTheOnlyStemmaOwner(stemmaId))
    } yield ()
  }

  def stemma(ts: TraversalSource, stemmaId: String, userId: String): Stemma = {
    val people = ts
      .V()
      .hasLabel(types.person)
      .has(keys.stemmaId, stemmaId)
      .map { person =>
        val name      = person.property(personKeys.name).value()
        val birthDate = person.property(personKeys.birthDate).toOption.map(LocalDate.parse)
        val deathDate = person.property(personKeys.deathDate).toOption.map(LocalDate.parse)
        val bio       = person.property(personKeys.bio).toOption
        val isOwner   = isOwnerOf(ts, userId, person)

        PersonDescription(person.id().toString, name, birthDate, deathDate, bio, !isOwner)
      }
      .toList()

    val families = ts
      .V()
      .hasLabel(types.family)
      .has(keys.stemmaId, stemmaId)
      .map { family =>
        val parents  = family.inE(relations.spouseOf).otherV().id().map(_.toString).toList()
        val children = family.inE(relations.childOf).otherV().id().map(_.toString).toList()
        val isOwner  = isOwnerOf(ts, userId, family)

        FamilyDescription(family.id().toString, parents, children, !isOwner)
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
      _      = description.bio.foreach(person.setProperty(personKeys.bio, _))
    } yield ()
  }

  def newFamily(ts: TraversalSource, stemmaId: String): String = {
    val family = ts.addV(types.family).head()
    family.setProperty(keys.stemmaId, stemmaId)
    family.id().toString
  }

  def findFamily(ts: TraversalSource, parent1: String, parent2: String) = {
    ts.V(parent1)
      .out(relations.spouseOf)
      .where(_.in(relations.spouseOf).map(_.id().toString).is(parent2))
      .headOption()
      .map(_.id().toString)
  }

  def findFamily(ts: TraversalSource, parent1: String) = {
    ts.V(parent1)
      .out(relations.spouseOf)
      .where(_.in(relations.spouseOf).count().is(P.eq(1)))
      .headOption()
      .map(_.id().toString)
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

  def chown(ts: TraversalSource, startPersonId: String): ChownEffect = {
    val familyIds = mutable.ListBuffer.empty[String]
    val personIds = mutable.ListBuffer.empty[String]

    def ancestorFamilies(family: GremlinScala[Vertex]) =
      family.repeat(f => f.in(relations.spouseOf).out(relations.childOf)).emit()

    def dependentFamilies(family: GremlinScala[Vertex]) =
      family.repeat(f => f.in(relations.childOf).out(relations.spouseOf)).emit()

    val initFamily = ts.V(startPersonId).out(relations.childOf, relations.spouseOf)
    initFamily
      .unionFlat(
        p => ancestorFamilies(p),
        p => dependentFamilies(p),
        p => p
      )
      .dedup()
      .sideEffect(family => familyIds += family.id().toString)
      .in(relations.childOf, relations.spouseOf)
      .dedup()
      .sideEffect(person => personIds += person.id().toString)
      .iterate()

    ChownEffect(familyIds.toList, personIds.toList)
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
    descr.bio foreach (personVertex.setProperty(personKeys.bio, _))

    personVertex.id().toString
  }

  private def setRelation(ts: TraversalSource, from: String, to: String, relation: String)(checks: RelationRestriction*): Either[StemmaError, Unit] = {
    import cats.syntax.traverse._

    val fromV = ts.V(from).head()
    val toV   = ts.V(to).head()

    if (fromV.out(relation).is(toV).exists()) Right((): Unit)
    else checks.toList.map(_.between(fromV, toV)).sequence.map(_ => fromV.addEdge(relation, toV))
  }

  def makeChildRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, personId, familyId, relations.childOf)(childShouldBelongToSingleFamily)

  def makeSpouseRelation(ts: TraversalSource, familyId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, personId, familyId, relations.spouseOf)()

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
          p.property(personKeys.deathDate).toOption.map(LocalDate.parse),
          p.property(personKeys.bio).toOption
        )

        tinkerpop.ExtendedPersonDescription(personDescr, childOf, spouseOf, stemmaId, List(ownerId))
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

        ExtendedFamilyDescription(f.id().toString, parents, children, stemmaId)
      }
      .toRight(NoSuchFamilyId(id))

  private def isOwnerOf(ts: TraversalSource, userId: String, resourceId: String)(resourceNotFound: String => StemmaError) =
    for {
      user     <- ts.V(userId).headOption().toRight(NoSuchUserId(userId))
      resource <- ts.V(resourceId).headOption().toRight(resourceNotFound(resourceId))
      isOwner  = user.outE(relations.ownerOf).where(_.otherV().is(resource)).headOption().isDefined
    } yield isOwner

  private def isOwnerOf(ts: TraversalSource, userId: String, resource: Vertex) = {
    val user = ts.V(userId).head()
    user.outE(relations.ownerOf).where(_.otherV().is(resource)).headOption().isDefined
  }

  def isFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, familyId)(NoSuchFamilyId)

  def isPersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, personId)(NoSuchPersonId)

  def isStemmaOwner(ts: TraversalSource, userId: String, stemmaId: String): Either[StemmaError, Boolean] =
    isOwnerOf(ts, userId, stemmaId)(NoSuchStemmaId)

  def makeFamilyOwner(ts: TraversalSource, userId: String, familyId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, familyId, relations.ownerOf)()

  def makePersonOwner(ts: TraversalSource, userId: String, personId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, personId, relations.ownerOf)()

  def makeGraphOwner(ts: TraversalSource, userId: String, stemmaId: String): Either[StemmaError, Unit] =
    setRelation(ts, userId, stemmaId, relations.ownerOf)()

  private def thereAreNoOtherOwners(currentOwner: Vertex, target: Vertex) =
    target
      .inE(relations.ownerOf)
      .where(_.otherV().is(P.neq(currentOwner)))
      .headOption()
      .isEmpty
}

private object StemmaRepository {
  trait RelationRestriction {
    def between(from: Vertex, to: Vertex): Either[StemmaError, Unit]
  }

  val childShouldBelongToSingleFamily: RelationRestriction = (child: Vertex, family: Vertex) => {
    child
      .outE(relations.childOf)
      .where(_.otherV().is(P.neq(family)))
      .otherV()
      .map(otherFamily => Left(ChildAlreadyBelongsToFamily(otherFamily.id().toString, child.id().toString)))
      .headOption()
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
    val bio: Key[String]       = Key[String]("bio")
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