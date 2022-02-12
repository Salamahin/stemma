package io.github.salamahin.stemma.service

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.Transaction._
import io.github.salamahin.stemma.tinkerpop.{ExtendedFamilyDescription, StemmaOperations}
import zio._

class StemmaService(graph: ScalaGraph, ops: StemmaOperations) {
  import cats.syntax.apply._
  import cats.syntax.traverse._

  def createGraph(userId: String, description: String) =
    IO.fromEither(transaction(graph) { tx =>
      val graphId = ops.newGraph(tx, description)
      ops.makeGraphOwner(tx, userId, graphId).map(_ => graphId)
    })

  def listOwnedGraphs(userId: String) = IO.fromEither(ops.listGraphs(graph.traversal, userId)).map(OwnedGraphs.apply)

  def createFamily(userId: String, graphId: String, family: FamilyDescription): IO[StemmaError, Family] = IO.fromEither(validateFamily(family) *> transaction(graph) { ts => createFamilyAndSetRelations(ts, graphId, userId, family) })

  private def createFamilyAndSetRelations(ts: TraversalSource, graphId: String, ownerId: String, family: FamilyDescription) = {
    val FamilyDescription(p1, p2, children) = family
    val familyId                            = ops.newFamily(ts, graphId)

    ops.makeFamilyOwner(ts, ownerId, familyId) *> setFamilyRelations(ts, graphId, ownerId, familyId, (p1 ++ p2).toSeq, children)
  }

  def updateFamily(userId: String, familyId: String, family: FamilyDescription): IO[StemmaError, Family] = IO.fromEither(
    transaction(graph)(ts =>
      for {
        isOwner <- ops.isFamilyOwner(ts, userId, familyId)
        f       <- if (isOwner) validateFamily(family) *> resetFamilyRelations(ts, userId, familyId, family) else Left(AccessToFamilyDenied(familyId))
      } yield f
    )
  )

  private def resetFamilyRelations(ts: TraversalSource, ownerId: String, familyId: String, family: FamilyDescription) = {
    val FamilyDescription(p1, p2, children) = family
    for {
      ExtendedFamilyDescription(Family(_, oldParents, oldChildren), graphId) <- ops.describeFamily(ts, familyId)
      _                                                                      <- oldParents.map(id => ops.removeSpouseRelation(ts, familyId, id)).sequence
      _                                                                      <- oldChildren.map(id => ops.removeChildRelation(ts, familyId, id)).sequence

      updatedFamily <- setFamilyRelations(ts, graphId, ownerId, familyId, (p1 ++ p2).toSeq, children)
    } yield updatedFamily
  }

  private def setFamilyRelations(ts: TraversalSource, graphId: String, ownerId: String, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
    def getOrCreatePerson(p: PersonDefinition) =
      p match {
        case ExistingPersonId(id) =>
          for {
            descr <- ops.describePerson(ts, id)
            _     <- if (descr.graphId != graphId) Left(NoSuchPersonId(id)) else Right((): Unit)
            _     <- if (descr.owner != ownerId) Left(AccessToPersonDenied(id)) else Right((): Unit)
          } yield id

        case p: PersonDescription =>
          val personId = ops.newPerson(ts, graphId, p)
          ops
            .makePersonOwner(ts, ownerId, personId)
            .map(_ => personId)
      }

    for {
      parentIds   <- parents.map(getOrCreatePerson).sequence
      childrenIds <- children.map(getOrCreatePerson).sequence
      _           <- parentIds.map(id => ops.makeSpouseRelation(ts, familyId, id)).sequence
      _           <- childrenIds.map(id => ops.makeChildRelation(ts, familyId, id)).sequence
    } yield Family(familyId, parentIds.toList, childrenIds.toList)
  }

  private def validateFamily(f: FamilyDescription): Either[StemmaError, FamilyDescription] = {
    def checkMembersCount(f: FamilyDescription) =
      if ((f.parent1 ++ f.parent2 ++ f.children).size <= 1) Left(IncompleteFamily(): StemmaError) else Right((): Unit)

    def checkDuplicatedIds(f: FamilyDescription) = {
      def collectDuplicatedIds(people: Seq[PersonDefinition]) =
        people
          .collect {
            case ExistingPersonId(id) => id
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

  def removePerson(userId: String, personId: String) = IO.fromEither(
    transaction(graph)(ts =>
      for {
        isOwner <- ops.isPersonOwner(ts, userId, personId)
        _       <- if (isOwner) removePersonAndDropEmptyFamilies(ts, personId) else Left(AccessToPersonDenied(personId))
      } yield ()
    )
  )

  private def removePersonAndDropEmptyFamilies(ts: TraversalSource, id: String) = {
    def removeFamilyIfNotConnecting2Persons(family: Family) =
      if ((family.parents ++ family.children).size < 2) ops.removeFamily(ts, family.id) else Right((): Unit)

    for {
      descr <- ops.describePerson(ts, id)
      _     <- ops.removePerson(ts, id)

      parentOfWhichFamily <- descr.spouseOf.map(ops.describeFamily(ts, _)).sequence
      childOfWhichFamily  <- descr.childOf.map(ops.describeFamily(ts, _)).toList.sequence

      _ <- (parentOfWhichFamily ++ childOfWhichFamily).map(_.family).map(removeFamilyIfNotConnecting2Persons).sequence
    } yield ()
  }

  def removeFamily(userId: String, familyId: String) = IO.fromEither(
    for {
      isOwner <- ops.isFamilyOwner(graph.traversal, userId, familyId)
      _       <- if (isOwner) ops.removeFamily(graph.traversal, familyId) else Left(AccessToFamilyDenied(familyId))
    } yield ()
  )

  def updatePerson(userId: String, personId: String, description: PersonDescription) = IO.fromEither(
    for {
      isOwner <- ops.isPersonOwner(graph.traversal, userId, personId)
      _       <- if (isOwner) ops.updatePerson(graph.traversal, personId, description) else Left(AccessToPersonDenied(personId))
    } yield ()
  )

  def stemma(userId: String, graphId: String) =
    IO.fromEither(for {
      isOwner <- ops.isGraphOwner(graph.traversal, userId, graphId)
      stemma  <- if (isOwner) Right(ops.stemma(graph.traversal, graphId)) else Left(AccessToGraphDenied(graphId))
    } yield stemma)

  def describeChown(userId: String, toUserId: String, targetPersonId: String) =
    IO.fromEither(transaction(graph)(ts => makeChown(ts, userId, toUserId, targetPersonId)))

  def chown(userId: String, toUserId: String, targetPersonId: String) = IO.fromEither(
    transaction(graph)(ts =>
      for {
        chown <- makeChown(ts, userId, toUserId, targetPersonId)
        _     <- chown.affectedFamilies.map(fid => ops.resetFamilyOwner(ts, toUserId, fid)).sequence
        _     <- chown.affectedPeople.map(pid => ops.resetPersonOwner(ts, toUserId, pid)).sequence
      } yield ()
    )
  )

  private def makeChown(ts: TraversalSource, userId: String, toUserId: String, targetPersonId: String) =
    for {
      isOwner <- ops.isPersonOwner(ts, userId, targetPersonId)
      chown   <- if (isOwner) ops.listChownEffect(ts, targetPersonId, toUserId) else Left(AccessToPersonDenied(targetPersonId))
    } yield chown
}

object StemmaService {
  val live: URLayer[GraphService with StemmaOperations, StemmaService] = (for {
    graph <- ZIO.environment[GraphService].map(_.get)
    ops   <- ZIO.environment[StemmaOperations].map(_.get)
  } yield new StemmaService(graph.graph, ops)).toLayer
}
