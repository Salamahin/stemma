package io.github.salamahin.stemma.service

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.{ExtendedFamilyDescription, StemmaRepository}
import io.github.salamahin.stemma.tinkerpop.Transaction._
import zio._

class StemmaService(graph: ScalaGraph, ops: StemmaRepository) {
  import cats.syntax.apply._
  import cats.syntax.traverse._

  def createStemma(userId: String, name: String) =
    ZIO.fromEither(transaction(graph) { tx =>
      val stemmaId = ops.newStemma(tx, name)
      ops.makeGraphOwner(tx, userId, stemmaId).map(_ => stemmaId)
    })

  def listOwnedStemmas(userId: String) = ZIO.fromEither(ops.listStemmas(graph.traversal, userId)).map(OwnedStemmasDescription.apply)

  def removeStemma(userId: String, stemmaId: String) = ZIO.fromEither(transaction(graph)(ts => ops.removeStemma(ts, stemmaId, userId)))

  def createFamily(userId: String, stemmaId: String, family: CreateFamily): IO[StemmaError, FamilyDescription] =
    ZIO.fromEither(validateFamily(family) *> transaction(graph) { ts => createFamilyAndSetRelations(ts, stemmaId, userId, family) })

  private def createFamilyAndSetRelations(ts: TraversalSource, stemmaId: String, ownerId: String, family: CreateFamily) = {
    val CreateFamily(p1, p2, children) = family

    val familyId = ((p1, p2) match {
      case (Some(ExistingPerson(parent1)), Some(ExistingPerson(parent2))) => ops.findFamily(ts, parent1, parent2)
      case (Some(ExistingPerson(parent1)), None)                          => ops.findFamily(ts, parent1)
      case (None, Some(ExistingPerson(parent2)))                          => ops.findFamily(ts, parent2)
      case _                                                              => None
    }).getOrElse(ops.newFamily(ts, stemmaId))

    ops.makeFamilyOwner(ts, ownerId, familyId) *> setFamilyRelations(ts, stemmaId, ownerId, familyId, (p1 ++ p2).toSeq, children)
  }

  def updateFamily(userId: String, familyId: String, family: CreateFamily): IO[StemmaError, FamilyDescription] = ZIO.fromEither(
    transaction(graph)(ts =>
      for {
        isOwner <- ops.isFamilyOwner(ts, userId, familyId)
        f       <- if (isOwner) validateFamily(family) *> resetFamilyRelations(ts, userId, familyId, family) else Left(AccessToFamilyDenied(familyId))
      } yield f
    )
  )

  private def resetFamilyRelations(ts: TraversalSource, ownerId: String, familyId: String, family: CreateFamily) = {
    val CreateFamily(p1, p2, children) = family
    for {
      ExtendedFamilyDescription(_, oldParents, oldChildren, stemmaId) <- ops.describeFamily(ts, familyId)
      _                                                               <- oldParents.map(id => ops.removeSpouseRelation(ts, familyId, id)).sequence
      _                                                               <- oldChildren.map(id => ops.removeChildRelation(ts, familyId, id)).sequence

      updatedFamily <- setFamilyRelations(ts, stemmaId, ownerId, familyId, (p1 ++ p2).toSeq, children)
    } yield updatedFamily
  }

  private def setFamilyRelations(ts: TraversalSource, stemmaId: String, ownerId: String, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
    def getOrCreatePerson(p: PersonDefinition) =
      p match {
        case ExistingPerson(id) =>
          for {
            descr <- ops.describePerson(ts, id)
            _     <- if (descr.stemmaId != stemmaId) Left(NoSuchPersonId(id)) else Right((): Unit)
            _     <- if (descr.owner != ownerId) Left(AccessToPersonDenied(id)) else Right((): Unit)
          } yield id

        case p: CreateNewPerson =>
          val personId = ops.newPerson(ts, stemmaId, p)
          ops
            .makePersonOwner(ts, ownerId, personId)
            .map(_ => personId)
      }

    for {
      parentIds   <- parents.map(getOrCreatePerson).sequence
      childrenIds <- children.map(getOrCreatePerson).sequence
      _           <- parentIds.map(id => ops.makeSpouseRelation(ts, familyId, id)).sequence
      _           <- childrenIds.map(id => ops.makeChildRelation(ts, familyId, id)).sequence
    } yield FamilyDescription(familyId, parentIds.toList, childrenIds.toList, false)
  }

  private def validateFamily(f: CreateFamily): Either[StemmaError, CreateFamily] = {
    def checkMembersCount(f: CreateFamily) =
      if ((f.parent1 ++ f.parent2 ++ f.children).size <= 1) Left(IncompleteFamily(): StemmaError) else Right((): Unit)

    def checkDuplicatedIds(f: CreateFamily) = {
      def collectDuplicatedIds(people: Seq[PersonDefinition]) =
        people
          .collect {
            case ExistingPerson(id) => id
          }
          .groupBy(identity)
          .values
          .collect {
            case ids if ids.size > 1 => ids.head
          }

      val duplicatedIds = collectDuplicatedIds((f.parent2 ++ f.parent1).toSeq ++ f.children).toList
      if (duplicatedIds.isEmpty) Right((): Unit) else Left(DuplicatedIds(duplicatedIds): StemmaError)
    }

    (checkMembersCount(f) *> checkDuplicatedIds(f)).map(_ => f)
  }

  def removePerson(userId: String, personId: String) = ZIO.fromEither(
    transaction(graph)(ts =>
      for {
        isOwner <- ops.isPersonOwner(ts, userId, personId)
        _       <- if (isOwner) removePersonAndDropEmptyFamilies(ts, personId) else Left(AccessToPersonDenied(personId))
      } yield ()
    )
  )

  private def removePersonAndDropEmptyFamilies(ts: TraversalSource, id: String) = {
    def removeFamilyIfNotConnecting2Persons(family: ExtendedFamilyDescription) =
      if ((family.parents ++ family.children).size < 2) ops.removeFamily(ts, family.id) else Right((): Unit)

    for {
      descr <- ops.describePerson(ts, id)
      _     <- ops.removePerson(ts, id)

      parentOfWhichFamily <- descr.spouseOf.map(ops.describeFamily(ts, _)).sequence
      childOfWhichFamily  <- descr.childOf.map(ops.describeFamily(ts, _)).toList.sequence

      _ <- (parentOfWhichFamily ++ childOfWhichFamily).map(removeFamilyIfNotConnecting2Persons).sequence
    } yield ()
  }

  def removeFamily(userId: String, familyId: String) =
    ZIO.fromEither(transaction(graph) { tx =>
      for {
        isOwner <- ops.isFamilyOwner(tx, userId, familyId)
        _       <- if (isOwner) ops.removeFamily(tx, familyId) else Left(AccessToFamilyDenied(familyId))
      } yield ()
    })

  def updatePerson(userId: String, personId: String, description: CreateNewPerson) =
    ZIO.fromEither(transaction(graph) { tx =>
      for {
        isOwner <- ops.isPersonOwner(tx, userId, personId)
        _       <- if (isOwner) ops.updatePerson(tx, personId, description) else Left(AccessToPersonDenied(personId))
      } yield ()
    })

  def stemma(userId: String, stemmaId: String) =
    ZIO.fromEither(transaction(graph) { tx =>
      for {
        isOwner <- ops.isStemmaOwner(tx, userId, stemmaId)
        stemma  <- if (isOwner) Right(ops.stemma(tx, stemmaId, userId)) else Left(AccessToStemmaDenied(stemmaId))
      } yield stemma
    })

  def chown(toUserId: String, targetPersonId: String) = ZIO.fromEither(
    transaction(graph)(ts => {
      for {
        person <- ops.describePerson(ts, targetPersonId)
        effect = ops.chown(ts, targetPersonId)
        _      <- ops.makeGraphOwner(ts, toUserId, person.stemmaId)
        _      <- effect.affectedPeople.traverse(p => ops.makePersonOwner(ts, toUserId, p))
        _      <- effect.affectedFamilies.traverse(f => ops.makeFamilyOwner(ts, toUserId, f))
      } yield effect
    })
  )

  def ownsPerson(userId: String, personId: String): IO[StemmaError, Boolean] = ZIO.fromEither(ops.isPersonOwner(graph.traversal, userId, personId))
}

object StemmaService {
  val live: URLayer[GraphService, StemmaService] = ZLayer(for {
    graph <- ZIO.service[GraphService]
  } yield new StemmaService(graph.graph, new StemmaRepository))
}
