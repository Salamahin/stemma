package io.github.salamahin.stemma.service

import io.github.salamahin.stemma._
import io.github.salamahin.stemma.gremlin.TinkerpopStemmaRepository
import io.github.salamahin.stemma.request._
import io.github.salamahin.stemma.response.Family
import io.github.salamahin.stemma.service.storage.{GraphStorage, STORAGE}
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
          case p: PersonDescription => ZIO.succeed(repo.newPerson(p))
        }

      for {
        familyId    <- ZIO.succeed(repo.newFamily())
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
      def membersCount(f: Family) = (f.parents ++ f.children).size
      def removeFamilyIfNotConnecting2Persons(family: Option[Family]) =
        family
          .find(f => membersCount(f) <= 2)
          .map(f => ZIO.fromEither(repo.removeFamily(f.id)))
          .getOrElse(ZIO.succeed())

      for {
        descr               <- ZIO.fromEither(repo.describePerson(id))
        _                   <- ZIO.fromEither(repo.removePerson(id))

        parentOfWhichFamily <- fromOptionEither(descr.spouseOf.map(id => repo.describeFamily(id)))
        childOfWhichFamily  <- fromOptionEither(descr.childOf.map(id => repo.describeFamily(id)))

        _                   <- removeFamilyIfNotConnecting2Persons(parentOfWhichFamily)
        _                   <- removeFamilyIfNotConnecting2Persons(childOfWhichFamily)
      } yield ()
    }

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] = ???

    override def stemma(): UIO[response.Stemma] = UIO.succeed(repo.stemma())
  }

  //todo: reload graph on error
  private class PersistentStemmaService(underlying: StemmaService, storage: GraphStorage, lock: USTM[TReentrantLock]) extends StemmaService {
    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, Family] =
      for {
        l      <- lock.commit
        family <- l.writeLock.use_(underlying.newFamily(family) <* storage.save())
      } yield family

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(underlying.updateFamily(familyId, family) <* storage.save())
      } yield ()

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(underlying.removePerson(id) <* storage.save())
      } yield ()

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.use_(underlying.updatePerson(id, description) <* storage.save())
      } yield ()

    override def stemma(): UIO[response.Stemma] =
      for {
        l  <- lock.commit
        st <- l.readLock.use_(underlying.stemma())
      } yield st
  }

  val basic: ZLayer[STORAGE, Nothing, STEMMA]       = ZLayer.fromFunctionM(gs => gs.get.load().map(fm => new StemmaServiceImpl(new TinkerpopStemmaRepository(fm))))
  val durable: URLayer[STEMMA with STORAGE, STEMMA] = (new PersistentStemmaService(_, _, TReentrantLock.make)).toLayer[StemmaService]
}
