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
    import com.vladkopanev.zio.saga.Saga._

    private def getOrCreatePerson(p: PersonDefinition) =
      p match {
        case ExistingPersonId(id) => ZIO.succeed(id).noCompensate
        case p: PersonDescription => ZIO.succeed(repo.newPerson(p)).compensateIfSuccess(id => ZIO.fromEither(repo.removePerson(id)))
      }

    private def createFamily() =
      for {
        id <- ZIO.succeed(repo.newFamily()).compensateIfSuccess(id => ZIO.fromEither(repo.removeFamily(id)))
      } yield id

    private def createChildRelation(familyId: String)(personId: String) =
      for {
        _ <- ZIO.fromEither(repo.setChildRelation(familyId, personId)) compensate ZIO.fromEither(repo.removeChildRelation(familyId, personId))
      } yield ()

    private def createSpouseRelation(familyId: String)(personId: String) =
      for {
        _ <- ZIO.fromEither(repo.setSpouseRelation(familyId, personId)) compensate ZIO.fromEither(repo.removeSpouseRelation(familyId, personId))
      } yield ()

    private def remakePerson(descr: ExtendedPersonDescription) = {
      def fold[E](value: Option[Either[E, Unit]]): Either[E, Unit] = value match {
        case Some(x) => x
        case None    => Right()
      }
      for {
        personId <- ZIO.succeed(repo.newPerson(descr.personDescription))
        _        <- ZIO.fromEither(fold(descr.childOf.map(familyId => repo.setChildRelation(familyId, personId))))
        _        <- ZIO.fromEither(fold(descr.spouseOf.map(familyId => repo.setSpouseRelation(familyId, personId))))
      } yield personId
    }

    private def createNewFamily(parents: Seq[PersonDefinition], children: Seq[PersonDefinition]) =
      (for {
        familyId    <- createFamily()
        parentIds   <- SagaExt.collectAll(parents.map(getOrCreatePerson))
        childrenIds <- SagaExt.collectAll(children.map(getOrCreatePerson))

        _ <- SagaExt.collectAll(parentIds.map(createSpouseRelation(familyId)))
        _ <- SagaExt.collectAll(childrenIds.map(createChildRelation(familyId)))
      } yield Family(familyId, parentIds, childrenIds)).transact

    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, Family] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.succeed(family)
        parents                             = (p1 ++ p2).toSeq
        _                                   <- if ((parents ++ children).size <= 1) ZIO.fail(IncompleteFamily()) else ZIO.succeed()
        familyId                            <- createNewFamily(parents, children)
      } yield familyId

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describeFamily(familyId)).noCompensate
      } yield ()).transact

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describePerson(id)).noCompensate
        _     <- ZIO.fromEither(repo.removePerson(id)) compensate remakePerson(descr).unit
      } yield ()).transact

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describePerson(id)).noCompensate
        _     <- ZIO.fromEither(repo.removePerson(id)) compensate remakePerson(descr).unit
        _     <- remakePerson(descr.copy(personDescription = description)).compensateIfSuccess(id => ZIO.fromEither(repo.removePerson(id)))
      } yield ()).transact

    override def stemma(): UIO[response.Stemma] = UIO.succeed(repo.stemma())
  }

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

  val basic: ZLayer[STORAGE, Nothing, STEMMA]       = ZLayer.fromFunctionM(gs => gs.get.make().map(fm => new StemmaServiceImpl(new TinkerpopStemmaRepository(fm))))
  val durable: URLayer[STEMMA with STORAGE, STEMMA] = (new PersistentStemmaService(_, _, TReentrantLock.make)).toLayer[StemmaService]
}
