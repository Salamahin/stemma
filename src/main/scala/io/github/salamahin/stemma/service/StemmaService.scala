package io.github.salamahin.stemma.service

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import io.github.salamahin.stemma.tinkerpop.Transaction._
import zio._

object StemmaService {
  class StemmaService(graph: ScalaGraph, ops: StemmaOperations) {
    import cats.syntax.apply._
    import cats.syntax.traverse._

    private def removePersonAndDropEmptyFamilies(ts: TraversalSource, id: String) = {
      def removeFamilyIfNotConnecting2Persons(family: Option[Family]) =
        family
          .find(f => (f.parents ++ f.children).size < 2)
          .map(f => ops.removeFamily(ts, f.id))
          .getOrElse(Right((): Unit))

      def fromOptionEither[E, T](value: Option[Either[E, T]]) = value match {
        case Some(value) => value.map(Some(_))
        case None        => Right(None)
      }

      for {
        descr <- ops.describePerson(ts, id)
        _     <- ops.removePerson(ts, id)

        parentOfWhichFamily <- fromOptionEither(descr.spouseOf.map(ops.describeFamily(ts, _)))
        childOfWhichFamily  <- fromOptionEither(descr.childOf.map(ops.describeFamily(ts, _)))

        _ <- removeFamilyIfNotConnecting2Persons(parentOfWhichFamily)
        _ <- removeFamilyIfNotConnecting2Persons(childOfWhichFamily)
      } yield ()
    }

    private def setFamilyRelations(ts: TraversalSource, graphId: String, ownerId: String, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
      def getOrCreatePerson(p: PersonDefinition) =
        p match {
          case ExistingPersonId(id) => Right(id)
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
      } yield Family(familyId, parentIds, childrenIds)
    }

    private def resetFamilyRelations(ts: TraversalSource, graphId: String, ownerId: String, familyId: String, family: FamilyDescription) = {
      val FamilyDescription(p1, p2, children) = family
      for {
        Family(_, oldParents, oldChildren) <- ops.describeFamily(ts, familyId)
        _                                  <- oldParents.map(id => ops.removeSpouseRelation(ts, familyId, id)).sequence
        _                                  <- oldChildren.map(id => ops.removeChildRelation(ts, familyId, id)).sequence

        updatedFamily <- setFamilyRelations(ts, graphId, ownerId, familyId, (p1 ++ p2).toSeq, children)
      } yield updatedFamily
    }

    private def createFamilyAndSetRelations(ts: TraversalSource, graphId: String, ownerId: String, family: FamilyDescription) = {
      val FamilyDescription(p1, p2, children) = family
      val familyId                            = ops.newFamily(ts, graphId)

      ops.makeFamilyOwner(ts, ownerId, familyId) *> setFamilyRelations(ts, graphId, ownerId, familyId, (p1 ++ p2).toSeq, children)
    }

    private def validateFamily(f: FamilyDescription): Either[StemmaError, FamilyDescription] = {
      import cats.implicits._

      def checkMembersCount(f: FamilyDescription) =
        if ((f.parent1 ++ f.parent2 ++ f.children).size <= 1) IncompleteFamily().invalidNec else ().validNec

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
        if (duplicatedIds.isEmpty) ().validNec else DuplicatedIds(duplicatedIds).invalidNec
      }
      (checkMembersCount(f), checkDuplicatedIds(f))
        .mapN((_, _) => f)
        .leftMap(chain => CompositeError(chain.toNonEmptyList.toList))
        .toEither
    }

    def createGraph(ownerId: String, description: String) =
      IO.fromEither(transaction(graph) { tx =>
        val graphId = ops.newGraph(tx, description)
        ops.makeGraphOwner(tx, ownerId, graphId).map(_ => graphId)
      })

    def listOwnedGraphs(ownerId: String) = IO.fromEither(ops.listGraphs(graph.traversal, ownerId))

    def createFamily(graphId: String, ownerId: String, family: FamilyDescription)                   = IO.fromEither(validateFamily(family) *> transaction(graph) { ts => createFamilyAndSetRelations(ts, graphId, ownerId, family) })
    def updateFamily(graphId: String, ownerId: String, familyId: String, family: FamilyDescription) = IO.fromEither(validateFamily(family) *> transaction(graph) { ts => resetFamilyRelations(ts, graphId, ownerId, familyId, family) })
    def removePerson(personId: String)                                                              = IO.fromEither(transaction(graph) { ts => removePersonAndDropEmptyFamilies(ts, personId) })

    def removeFamily(familyId: String)                                 = IO.fromEither(ops.removeFamily(graph.traversal, familyId))
    def updatePerson(personId: String, description: PersonDescription) = IO.fromEither(ops.updatePerson(graph.traversal, personId, description))
    def stemma(graphId: String)                                        = UIO(ops.stemma(graph.traversal, graphId))
  }

  type STEMMA = Has[StemmaService]

  val live: URLayer[GRAPH with OPS, STEMMA] = (for {
    graph <- ZIO.environment[GRAPH].map(_.get)
    ops   <- ZIO.environment[OPS].map(_.get)
  } yield new StemmaService(graph.graph, ops)).toLayer
}
