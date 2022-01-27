package io.github.salamahin.stemma.tinkerpop

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain._
import org.apache.commons.lang3.exception.ExceptionUtils

import scala.util.Try

class StemmaRepository(graph: ScalaGraph, ops: StemmaOperations) {
  import cats.instances.either._
  import cats.syntax.either._
  import cats.syntax.traverse._

  private def setFamilyRelations(tx: TraversalSource, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
    def getOrCreatePerson(p: PersonDefinition) =
      p match {
        case ExistingPersonId(id) => id
        case p: PersonDescription => ops.newPerson(tx, p)
      }

    val parentIds   = parents.map(getOrCreatePerson)
    val childrenIds = children.map(getOrCreatePerson)

    for {
      _ <- parentIds.map(id => ops.setSpouseRelation(tx, familyId, id)).sequence
      _ <- childrenIds.map(id => ops.setChildRelation(tx, familyId, id)).sequence
    } yield Family(familyId, parentIds, childrenIds)
  }

  private def validateFamily(f: FamilyDescription) = {
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

  private def createFamilyAndSetRelations(family: FamilyDescription)(tx: TraversalSource) = {
    for {
      FamilyDescription(p1, p2, children) <- validateFamily(family)
      familyId                            = ops.newFamily(tx)
      createdFamily                       <- setFamilyRelations(tx, familyId, (p1 ++ p2).toSeq, children)
    } yield createdFamily
  }

  private def resetFamilyRelations(familyId: String, family: FamilyDescription)(tx: TraversalSource) =
    for {
      FamilyDescription(p1, p2, children) <- validateFamily(family)
      Family(_, oldParents, oldChildren)  <- ops.describeFamily(tx, familyId)
      _                                   <- oldParents.map(id => ops.removeSpouseRelation(tx, familyId, id)).sequence
      _                                   <- oldChildren.map(id => ops.removeChildRelation(tx, familyId, id)).sequence

      updatedFamily <- setFamilyRelations(tx, familyId, (p1 ++ p2).toSeq, children)
    } yield updatedFamily

  private def removePersonAndDropEmptyFamilies(id: String)(tx: TraversalSource) = {
    def removeFamilyIfNotConnecting2Persons(family: Option[Family]) =
      family
        .find(f => (f.parents ++ f.children).size < 2)
        .map(f => ops.removeFamily(tx, f.id))
        .getOrElse(Right((): Unit))

    def fromOptionEither[E, T](value: Option[Either[E, T]]) = value match {
      case Some(value) => value.map(Some(_))
      case None        => Right(None)
    }

    for {
      descr <- ops.describePerson(tx, id)
      _     <- ops.removePerson(tx, id)

      parentOfWhichFamily <- fromOptionEither(descr.spouseOf.map(ops.describeFamily(tx, _)))
      childOfWhichFamily  <- fromOptionEither(descr.childOf.map(ops.describeFamily(tx, _)))

      _ <- removeFamilyIfNotConnecting2Persons(parentOfWhichFamily)
      _ <- removeFamilyIfNotConnecting2Persons(childOfWhichFamily)
    } yield ()
  }

  private def transaction[T](f: TraversalSource => Either[StemmaError, T]): Either[StemmaError, T] = {
    val tx = graph.tx()

    Try(f(tx.begin()))
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

  def newFamily(family: FamilyDescription): Either[StemmaError, Family]                      = transaction { createFamilyAndSetRelations(family) }
  def updateFamily(familyId: String, family: FamilyDescription): Either[StemmaError, Family] = transaction { resetFamilyRelations(familyId, family) }
  def removePerson(id: String): Either[StemmaError, Unit]                                    = transaction { removePersonAndDropEmptyFamilies(id) }

  def removeFamily(familyId: String): Either[NoSuchFamilyId, Unit]                           = ops.removeFamily(graph.traversal, familyId)
  def updatePerson(id: String, description: PersonDescription): Either[NoSuchPersonId, Unit] = ops.updatePerson(graph.traversal, id, description)
  def stemma(): Stemma                                                                       = ops.stemma(graph.traversal)

}
