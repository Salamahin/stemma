package io.github.salamahin.stemma.service

import io.github.salamahin.stemma._
import io.github.salamahin.stemma.request._
import io.github.salamahin.stemma.response.Family
import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.service.storage.{STORAGE, Storage}
import io.github.salamahin.stemma.tinkerpop.TinkerpopStemmaRepository
import zio._
import zio.stm.{TReentrantLock, USTM}

object stemma {
  trait StemmaService {
    def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, Family]
    def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit]
    def removePerson(id: String): ZIO[Any, StemmaError, Unit]
    def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit]
    def stemma(): UIO[response.Stemma]
  }

  type STEMMA = Has[StemmaService]

  private class StemmaServiceImpl(repo: StemmaRepository) extends StemmaService {

    private def fromOptionEither[E, T](value: Option[Either[E, T]]) = value match {
      case Some(value) => ZIO.fromEither(value.map(Some(_)))
      case None        => ZIO.none
    }

    private def createNewFamily(parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) = {
      def getOrCreatePerson(p: PersonDefinition) =
        p match {
          case ExistingPersonId(id) => ZIO.succeed(id)
          case p: PersonDescription => UIO(repo.newPerson(p))
        }

      for {
        familyId    <- UIO(repo.newFamily())
        parentIds   <- ZIO.foreach(parents)(getOrCreatePerson)
        childrenIds <- ZIO.foreach(children)(getOrCreatePerson)

        _ <- ZIO.foreach_(parentIds)(personId => ZIO.fromEither(repo.setSpouseRelation(familyId, personId)))
        _ <- ZIO.foreach_(childrenIds)(personId => ZIO.fromEither(repo.setChildRelation(familyId, personId)))
      } yield Family(familyId, parentIds, childrenIds)
    }

    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, Family] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.succeed(family)
        parents                             = (p1 ++ p2).toSeq
        _                                   <- if ((parents ++ children).size <= 1) ZIO.fail(IncompleteFamily()) else ZIO.succeed()
        familyId                            <- createNewFamily(parents, children)
      } yield familyId

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] = ???

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] = {
      def removeFamilyIfNotConnecting2Persons(family: Option[Family]) =
        family
          .find(f => (f.parents ++ f.children).size < 2)
          .map(f => ZIO.fromEither(repo.removeFamily(f.id)))
          .getOrElse(ZIO.succeed())

      for {
        descr <- ZIO.fromEither(repo describePerson id)
        _     <- ZIO.fromEither(repo removePerson id)

        parentOfWhichFamily <- fromOptionEither(descr.spouseOf map repo.describeFamily)
        childOfWhichFamily  <- fromOptionEither(descr.childOf map repo.describeFamily)

        _ <- removeFamilyIfNotConnecting2Persons(parentOfWhichFamily)
        _ <- removeFamilyIfNotConnecting2Persons(childOfWhichFamily)
      } yield ()
    }

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] = ???

    override def stemma(): UIO[response.Stemma] = UIO(repo.stemma())
  }

  private class PersistentStemmaService(storage: Storage, underlying: StemmaService, lock: USTM[TReentrantLock]) extends StemmaService {
    private def saveChangesOrReload[E, V](f: StemmaService => ZIO[Any, E, V]) =
      f(underlying).tapError(_ => storage.load()) <* storage.save()

    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, Family] =
      for {
        l      <- lock.commit
        family <- l.writeLock.use_(saveChangesOrReload(_.newFamily(family)))
      } yield family

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.updateFamily(familyId, family)))
      } yield ()

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.removePerson(id)))
      } yield ()

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(saveChangesOrReload(_.updatePerson(id, description)))
      } yield ()

    override def stemma(): UIO[response.Stemma] =
      for {
        l  <- lock.commit
        st <- l.readLock.use_(underlying.stemma())
      } yield st
  }

  val basic: ZLayer[GRAPH, Nothing, STEMMA] = {
    ZIO.access[GRAPH](gr => new StemmaServiceImpl(new TinkerpopStemmaRepository(gr.get.graph))).toLayer
  }

  val durable: URLayer[STEMMA with STORAGE, STEMMA] = (new PersistentStemmaService(_, _, TReentrantLock.make)).toLayer[StemmaService]
}
