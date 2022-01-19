package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma._
import io.github.salamahin.stemma.request._
import io.github.salamahin.stemma.response.Family
import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.service.storage.{STORAGE, Storage}
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import zio._
import zio.stm.{TReentrantLock, USTM}

object stemma {

  type STEMMA = Has[StemmaService]

  trait StemmaService {
    def newFamily(family: FamilyDescription): IO[StemmaError, Family]
    def updateFamily(familyId: String, family: FamilyDescription): IO[StemmaError, Family]
    def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit]
    def removePerson(id: String): IO[StemmaError, Unit]
    def updatePerson(id: String, description: PersonDescription): IO[StemmaError, Unit]
    def stemma(): UIO[response.Stemma]
  }

  private class StemmaServiceImpl(graph: Ref[ScalaGraph]) extends StemmaService {
    private val repo = graph.map(new StemmaRepository(_))

    private def setFamilyRelations(repo: StemmaRepository, familyId: String, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
      def getOrCreatePerson(p: PersonDefinition) =
        p match {
          case ExistingPersonId(id) => ZIO.succeed(id)
          case p: PersonDescription => UIO(repo.newPerson(p))
        }

      for {
        parentIds   <- ZIO.foreach(parents)(getOrCreatePerson)
        childrenIds <- ZIO.foreach(children)(getOrCreatePerson)

        _ <- ZIO.foreach_(parentIds)(personId => ZIO.fromEither(repo.setSpouseRelation(familyId, personId)))
        _ <- ZIO.foreach_(childrenIds)(personId => ZIO.fromEither(repo.setChildRelation(familyId, personId)))
      } yield Family(familyId, parentIds, childrenIds)
    }

    private def validateFamily(f: FamilyDescription) = {
      import cats.syntax.validated._

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

      import cats.syntax.apply._
      (checkMembersCount(f), checkDuplicatedIds(f))
        .mapN((_, _) => f)
        .leftMap(chain => CompositeError(chain.toNonEmptyList.toList))
        .toEither
    }

    override def newFamily(family: FamilyDescription): IO[StemmaError, Family] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.fromEither(validateFamily(family))
        r                                   <- repo.get
        familyId                            = r.newFamily()
        createdFamily                       <- setFamilyRelations(r, familyId, (p1 ++ p2).toSeq, children)
      } yield createdFamily

    override def updateFamily(familyId: String, family: FamilyDescription): IO[StemmaError, Family] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.fromEither(validateFamily(family))

        repo                               <- repo.get
        Family(_, oldParents, oldChildren) <- IO.fromEither(repo.describeFamily(familyId))
        _                                  <- IO.foreach_(oldParents)(parentId => ZIO.fromEither(repo.removeSpouseRelation(familyId, parentId)))
        _                                  <- IO.foreach_(oldChildren)(childId => ZIO.fromEither(repo.removeChildRelation(familyId, childId)))

        updatedFamily <- setFamilyRelations(repo, familyId, (p1 ++ p2).toSeq, children)
      } yield updatedFamily

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] = {
      def removeFamilyIfNotConnecting2Persons(repo: StemmaRepository, family: Option[Family]) =
        family
          .find(f => (f.parents ++ f.children).size < 2)
          .map(f => ZIO.fromEither(repo.removeFamily(f.id)))
          .getOrElse(ZIO.succeed())

      def fromOptionEither[E, T](value: Option[Either[E, T]]) = value match {
        case Some(value) => ZIO.fromEither(value.map(Some(_)))
        case None        => ZIO.none
      }

      for {
        repo  <- repo.get
        descr <- ZIO.fromEither(repo describePerson id)
        _     <- ZIO.fromEither(repo removePerson id)

        parentOfWhichFamily <- fromOptionEither(descr.spouseOf map repo.describeFamily)
        childOfWhichFamily  <- fromOptionEither(descr.childOf map repo.describeFamily)

        _ <- removeFamilyIfNotConnecting2Persons(repo, parentOfWhichFamily)
        _ <- removeFamilyIfNotConnecting2Persons(repo, childOfWhichFamily)
      } yield ()
    }

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] = repo.get.flatMap(r => ZIO.fromEither(r.updatePerson(id, description)))

    override def stemma(): UIO[response.Stemma] = repo.get.map(_.stemma())

    override def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit] = repo.get.flatMap(r => IO.fromEither(r.removeFamily(familyId)))
  }

  private class PersistentStemmaService(storage: Storage, underlying: StemmaService, lock: USTM[TReentrantLock]) extends StemmaService {
    private def saveChangesOrReload[E, V](f: StemmaService => IO[E, V]) =
      f(underlying).tapError(_ => storage.load()) <* storage.save()

    override def newFamily(family: FamilyDescription): IO[StemmaError, Family] =
      for {
        l      <- lock.commit
        family <- l.writeLock.use_(saveChangesOrReload(_.newFamily(family)))
      } yield family

    override def updateFamily(familyId: String, family: FamilyDescription): IO[StemmaError, Family] =
      for {
        l      <- lock.commit
        family <- l.writeLock.use_(saveChangesOrReload(_.updateFamily(familyId, family)))
      } yield family

    override def removePerson(id: String): IO[StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.removePerson(id)))
      } yield ()

    override def updatePerson(id: String, description: PersonDescription): IO[StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.updatePerson(id, description)))
      } yield ()

    override def stemma(): UIO[response.Stemma] =
      for {
        l  <- lock.commit
        st <- l.readLock.use_(underlying.stemma())
      } yield st

    override def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.removeFamily(familyId)))
      } yield ()
  }

  val basic: ZLayer[GRAPH, Nothing, STEMMA]         = ZIO.access[GRAPH] { service => new StemmaServiceImpl(service.get.graph) }.toLayer
  val durable: URLayer[STEMMA with STORAGE, STEMMA] = (new PersistentStemmaService(_, _, TReentrantLock.make)).toLayer[StemmaService]
}
