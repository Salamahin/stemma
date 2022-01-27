package io.github.salamahin.stemma.service

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import org.apache.commons.lang3.exception.ExceptionUtils
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import zio._

import scala.util.Try

object StemmaService {
  class StemmaService(graph: ScalaGraph, ops: StemmaOperations) {
    import cats.syntax.apply._
    import cats.syntax.either._
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

    private def setFamilyRelations(ts: TraversalSource, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
      def getOrCreatePerson(p: PersonDefinition) =
        p match {
          case ExistingPersonId(id) => id
          case p: PersonDescription => ops.newPerson(ts, p)
        }

      val parentIds   = parents.map(getOrCreatePerson)
      val childrenIds = children.map(getOrCreatePerson)

      for {
        _ <- parentIds.map(id => ops.setSpouseRelation(ts, familyId, id)).sequence
        _ <- childrenIds.map(id => ops.setChildRelation(ts, familyId, id)).sequence
      } yield Family(familyId, parentIds, childrenIds)
    }

    private def resetFamilyRelations(ts: TraversalSource, familyId: String, family: FamilyDescription) = {
      val FamilyDescription(p1, p2, children) = family
      for {
        Family(_, oldParents, oldChildren) <- ops.describeFamily(ts, familyId)
        _                                  <- oldParents.map(id => ops.removeSpouseRelation(ts, familyId, id)).sequence
        _                                  <- oldChildren.map(id => ops.removeChildRelation(ts, familyId, id)).sequence

        updatedFamily <- setFamilyRelations(ts, familyId, (p1 ++ p2).toSeq, children)
      } yield updatedFamily
    }

    private def createFamilyAndSetRelations(ts: TraversalSource, family: FamilyDescription) = {
      val FamilyDescription(p1, p2, children) = family
      val familyId                            = ops.newFamily(ts)
      setFamilyRelations(ts, familyId, (p1 ++ p2).toSeq, children)
    }

    private def transaction[T](f: TraversalSource => Either[StemmaError, T]): Either[StemmaError, T] = {
      val tx = graph.tx()

      Try(f(TraversalSource(tx.begin(): GraphTraversalSource)))
        .toEither
        .leftMap(err => UnknownError(ExceptionUtils.getStackTrace(err)): StemmaError)
        .flatten
        .bimap(
          err => {
            tx.rollback()
            err
          },
          res => {
            tx.commit()
            tx.close()
            res
          }
        )
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

    def createFamily(family: FamilyDescription)                   = IO.fromEither(validateFamily(family) *> transaction { ts => createFamilyAndSetRelations(ts, family) })
    def updateFamily(familyId: String, family: FamilyDescription) = IO.fromEither(validateFamily(family) *> transaction { ts => resetFamilyRelations(ts, familyId, family) })
    def removePerson(id: String)                                  = IO.fromEither(transaction { ts => removePersonAndDropEmptyFamilies(ts, id) })

    def removeFamily(familyId: String)                           = IO.fromEither(ops.removeFamily(graph.traversal, familyId))
    def updatePerson(id: String, description: PersonDescription) = IO.fromEither(ops.updatePerson(graph.traversal, id, description))
    def stemma()                                                 = UIO(ops.stemma(graph.traversal))
  }

  type STEMMA = Has[StemmaService]

  val live: URLayer[GRAPH, STEMMA] = ZIO
    .environment[GRAPH]
    .map(_.get)
    .flatMap(_.graph)
    .map(new StemmaService(_, new StemmaOperations))
    .toLayer
}
