package io.github.salamahin.stemma.service

import cats.implicits.catsSyntaxTuple2Semigroupal
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.service.storage.{STORAGE, StorageService}
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import zio._
import zio.stm.TReentrantLock

object stemma {
  trait StemmaService {
    def newFamily(family: FamilyDescription): IO[StemmaError, Family]
    def updateFamily(familyId: Long, family: FamilyDescription): IO[StemmaError, Family]
    def removeFamily(familyId: Long): IO[NoSuchFamilyId, Unit]
    def removePerson(id: Long): IO[StemmaError, Unit]
    def updatePerson(id: Long, description: PersonDescription): IO[StemmaError, Unit]
    def stemma(): UIO[Stemma]
  }

  type STEMMA = Has[StemmaService]

  private class StemmaServiceImpl(repo: ZRef[Nothing, Nothing, _, StemmaRepository]) extends StemmaService {
    private def setFamilyRelations(repo: StemmaRepository, familyId: Long, parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
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

    override def updateFamily(familyId: Long, family: FamilyDescription): IO[StemmaError, Family] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.fromEither(validateFamily(family))

        repo                               <- repo.get
        Family(_, oldParents, oldChildren) <- IO.fromEither(repo.describeFamily(familyId))
        _                                  <- IO.foreach_(oldParents)(parentId => ZIO.fromEither(repo.removeSpouseRelation(familyId, parentId)))
        _                                  <- IO.foreach_(oldChildren)(childId => ZIO.fromEither(repo.removeChildRelation(familyId, childId)))

        updatedFamily <- setFamilyRelations(repo, familyId, (p1 ++ p2).toSeq, children)
      } yield updatedFamily

    override def removePerson(id: Long): ZIO[Any, StemmaError, Unit] = {
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

    override def updatePerson(id: Long, description: PersonDescription): ZIO[Any, StemmaError, Unit] = repo.get.flatMap(r => ZIO.fromEither(r.updatePerson(id, description)))

    override def stemma(): UIO[Stemma] = repo.get.map(_.stemma())

    override def removeFamily(familyId: Long): IO[NoSuchFamilyId, Unit] = repo.get.flatMap(r => IO.fromEither(r.removeFamily(familyId)))
  }

  private class PersistentStemmaService(storage: StorageService, underlying: StemmaService, lock: TReentrantLock) extends StemmaService {
    private def saveChangesOrReload[E, V](f: StemmaService => IO[E, V]) =
      f(underlying).tapError { _ => storage.load() } <* storage.save()

    override def newFamily(family: FamilyDescription): IO[StemmaError, Family] =
      lock.writeLock.use_(saveChangesOrReload(_.newFamily(family)))

    override def updateFamily(familyId: Long, family: FamilyDescription): IO[StemmaError, Family] =
      lock.writeLock.use_(saveChangesOrReload(_.updateFamily(familyId, family)))

    override def removePerson(id: Long): IO[StemmaError, Unit] =
      lock.writeLock.use_(saveChangesOrReload(_.removePerson(id)))

    override def updatePerson(id: Long, description: PersonDescription): IO[StemmaError, Unit] =
      lock.writeLock.use_(saveChangesOrReload(_.updatePerson(id, description)))

    override def stemma(): UIO[Stemma] =
      lock.readLock.use_(underlying.stemma())

    override def removeFamily(familyId: Long): IO[NoSuchFamilyId, Unit] =
      lock.writeLock.use_(saveChangesOrReload(_.removeFamily(familyId)))
  }

  val basic: URLayer[GRAPH, STEMMA] = (for {
    g       <- ZIO.environment[GRAPH]
    service = new StemmaServiceImpl(g.get.graph.map(new StemmaRepository(_)))
  } yield service).toLayer

  val durable: URLayer[STORAGE with STEMMA, STEMMA] =
    (for {
      semaphore <- TReentrantLock.make.commit
      storage   <- ZIO.environment[STORAGE]
      stemma    <- ZIO.environment[STEMMA]
    } yield new PersistentStemmaService(storage.get, stemma.get, semaphore)).toLayer
}
