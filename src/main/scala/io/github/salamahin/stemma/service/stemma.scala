package io.github.salamahin.stemma.service

import com.vladkopanev.zio.saga.Saga
import io.github.salamahin.stemma._
import io.github.salamahin.stemma.gremlin.TinkerpopStemmaRepository
import io.github.salamahin.stemma.request._
import io.github.salamahin.stemma.service.storage.GraphStorage
import zio._
import zio.stm.{TReentrantLock, USTM}

object stemma {
  trait Stemma {
    def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, String]
    def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit]
    def removePerson(id: String): ZIO[Any, StemmaError, Unit]
    def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit]
    def stemma(): UIO[response.Stemma]
  }

  private class StemmaService(repo: StemmaRepository) extends Stemma {
    import com.vladkopanev.zio.saga.Saga._

    private def separatePeople(people: List[PersonDefinition]) = people.partitionMap {
      case existing: ExistingPersonId   => Left(existing)
      case newPerson: PersonDescription => Right(newPerson)
    }

    private def createPerson(p: PersonDescription) =
      for {
        id <- ZIO.succeed(repo.newPerson(p)).compensateIfSuccess(id => ZIO.fromEither(repo.removePerson(id)))
      } yield id

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

    private def createNewFamily(newParents: List[PersonDescription], newChildren: List[PersonDescription], existentParents: List[ExistingPersonId], existentChildren: List[ExistingPersonId]) =
      (for {
        familyId       <- createFamily()
        newParentIds   <- Saga.collectAllPar(newParents.map(createPerson))
        newChildrenIds <- Saga.collectAllPar(newChildren.map(createPerson))

        parentIds   = newParentIds ++ existentParents.map(_.id)
        childrenIds = newChildrenIds ++ existentChildren.map(_.id)

        _ <- Saga.collectAllPar(parentIds.map(createSpouseRelation(familyId)))
        _ <- Saga.collectAllPar(childrenIds.map(createChildRelation(familyId)))
      } yield familyId).transact

    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, String] =
      for {
        FamilyDescription(p1, p2, children) <- ZIO.succeed(family)
        (existentParents, newParents)       = separatePeople((p1 ++ p2).toList)
        (existentChildren, newChildren)     = separatePeople(children)
        familyId                            <- createNewFamily(newParents, newChildren, existentParents, existentChildren)
      } yield familyId

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describeFamily(familyId)).noCompensate
      } yield ()).transact

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describePerson(id)).noCompensate
        _     <- ZIO.fromEither(repo.removePerson(id)) compensate remakePerson(descr).map(_ => ())
      } yield ()).transact

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] =
      (for {
        descr <- ZIO.fromEither(repo.describePerson(id)).noCompensate
        _     <- ZIO.fromEither(repo.removePerson(id)) compensate remakePerson(descr).map(_ => ())
        _     <- remakePerson(descr.copy(personDescription = description)).compensateIfSuccess(id => ZIO.fromEither(repo.removePerson(id)))
      } yield ()).transact

    override def stemma(): UIO[response.Stemma] = UIO.succeed(repo.stemma())
  }

  private class PersistentStemmaService(underlying: Stemma, storage: GraphStorage, lock: USTM[TReentrantLock]) extends Stemma {
    override def newFamily(family: FamilyDescription): ZIO[Any, StemmaError, String] =
      for {
        l      <- lock.commit
        family <- l.writeLock.useDiscard(underlying.newFamily(family) <* storage.save())
      } yield family

    override def updateFamily(familyId: String, family: FamilyDescription): ZIO[Any, NoSuchFamilyId, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.useDiscard(underlying.updateFamily(familyId, family) <* storage.save())
      } yield ()

    override def removePerson(id: String): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.useDiscard(underlying.removePerson(id) <* storage.save())
      } yield ()

    override def updatePerson(id: String, description: PersonDescription): ZIO[Any, StemmaError, Unit] =
      for {
        l <- lock.commit
        _ <- l.writeLock.useDiscard(underlying.updatePerson(id, description) <* storage.save())
      } yield ()

    override def stemma(): UIO[response.Stemma] =
      for {
        l  <- lock.commit
        st <- l.readLock.useDiscard(underlying.stemma())
      } yield st
  }

  val basic: ZLayer[GraphStorage, Nothing, Stemma] = ZLayer.fromFunctionZIO(gs => gs.get.make().map(fm => new StemmaService(new TinkerpopStemmaRepository(fm))))

  val durable: URLayer[Stemma with GraphStorage, Stemma] = (new PersistentStemmaService(_, _, TReentrantLock.make)).toLayer[Stemma]
}
