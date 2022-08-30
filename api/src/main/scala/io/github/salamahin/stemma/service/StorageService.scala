package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{Stemma => DomainStemma, _}
import io.github.salamahin.stemma.storage.Tables
import slick.jdbc.PostgresProfile
import zio.{IO, Scope, Task, UIO, ZIO, ZLayer}

import scala.collection.mutable
import scala.concurrent.ExecutionContext

trait StorageService {
  def createSchema: Task[Unit]
  def getOrCreateUser(email: String): UIO[User]
  def createStemma(userId: Long, name: String): UIO[Long]
  def listOwnedStemmas(userId: Long): UIO[OwnedStemmasDescription]
  def removeStemma(userId: Long, stemmaId: Long): IO[StemmaError, Unit]
  def createFamily(userId: Long, stemmaId: Long, family: CreateFamily): IO[StemmaError, FamilyDescription]
  def updateFamily(userId: Long, familyId: Long, family: CreateFamily): IO[StemmaError, FamilyDescription]
  def removePerson(userId: Long, personId: Long): IO[StemmaError, Unit]
  def removeFamily(userId: Long, familyId: Long): IO[StemmaError, Unit]
  def updatePerson(userId: Long, personId: Long, description: CreateNewPerson): IO[StemmaError, Unit]
  def stemma(userId: Long, stemmaId: Long): IO[StemmaError, DomainStemma]
  def chown(userId: Long, stemmaId: Long, targetPersonId: Long): UIO[ChownEffect]
  def ownsPerson(userId: Long, personId: Long): UIO[Boolean]
}

object StorageService {
  val slick: ZLayer[Scope, Throwable, StorageService] = ZLayer.fromZIO {
    ZIO.acquireRelease(ZIO.attempt(new ConfiguredStemmaService))(c => ZIO.succeed(c.close()))
  }
}

abstract class SlickStemmaService() extends Tables with PostgresProfile with StorageService {
  import api._

  val db: backend.DatabaseDef

  override def createSchema: Task[Unit] = ZIO.fromFuture { implicit ec =>
    db run (qStemmaUsers.schema ++ qStemmas.schema ++ qPeople.schema ++ qFamilies.schema ++ qFamiliesOwners.schema ++ qPeopleOwners.schema ++ qStemmaOwners.schema ++ qSpouses.schema ++ qChildren.schema).createIfNotExists
  }

  def close() = db.close()

  override def getOrCreateUser(email: String): UIO[User] =
    ZIO.fromFuture { implicit ec =>
      val userId = qStemmaUsers returning qStemmaUsers.map(_.id)

      val query = (for {
        maybeUserId <- qStemmaUsers.filter(_.email === email).map(_.id).result.headOption
        userId      <- maybeUserId.map(id => DBIO.successful(id)).getOrElse(userId += StemmaUser(email = email))
      } yield User(userId, email)).transactionally

      db run query
    }.orDie

  private def checkStemmaAccess(stemmaId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedStemma = qStemmaOwners.filter(so => so.ownerId === userId && so.stemmaId === stemmaId)

    for {
      isOwner <- ownedStemma.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToStemmaDenied(stemmaId))
    } yield ()
  }

  private def checkPersonAccess(personId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedPeople = qPeopleOwners.filter(po => po.ownerId === userId && po.personId === personId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToPersonDenied(personId))
    } yield ()
  }

  private def checkFamilyAccess(familyId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedPeople = qFamiliesOwners.filter(fo => fo.ownerId === userId && fo.familyId === familyId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToFamilyDenied(familyId))
    } yield ()
  }

  private def checkStemmaCorrectness(personId: Long, stemmaId: Long)(implicit ec: ExecutionContext) = {
    qPeople.filter(_.id === personId).map(_.stemmaId).result.head.flatMap(sId => if (sId != stemmaId) DBIO.failed(NoSuchPersonId(personId)) else DBIO.successful((): Unit))
  }

  override def createStemma(userId: Long, name: String): UIO[Long] =
    ZIO.fromFuture { implicit ec =>
      val query = (for {
        newStemmaId <- (qStemmas returning qStemmas.map(_.id)) += Stemma(name = name)
        _           <- qStemmaOwners += StemmaOwner(userId, newStemmaId)
      } yield newStemmaId).transactionally

      db run query
    }.orDie

  override def listOwnedStemmas(userId: Long): UIO[OwnedStemmasDescription] =
    ZIO.fromFuture { implicit ec =>
      val ownedStemmas = qStemmaOwners.filter(_.ownerId === userId).map(_.stemmaId)

      val ownersCounted = (ownedStemmas join qStemmaOwners on (_ === _.stemmaId))
        .groupBy(_._1)
        .map {
          case (stemmaId, owners) => (stemmaId, owners.map(_._2.ownerId).size)
        }

      val stemmasWithRemovableFlag = (qStemmas join ownersCounted on ((l, r) => l.id === r._1))
        .map {
          case (stemma, (_, numberOwners)) => (stemma.id, stemma.name, numberOwners === 1)
        }
        .result
        .map(_.map {
          case (id, name, removable) => StemmaDescription(id, name, removable)
        })

      db.run(stemmasWithRemovableFlag).map(OwnedStemmasDescription.apply)
    }.orDie

  override def removeStemma(userId: Long, stemmaId: Long): IO[StemmaError, Unit] =
    ZIO
      .fromFuture { implicit ec =>
        val isOnlyOwner = qStemmaOwners
          .filter(_.stemmaId === stemmaId)
          .groupBy(_.stemmaId)
          .map {
            case (_, groups) => groups.length === 1
          }

        val query = (for {
          _           <- checkStemmaAccess(stemmaId, userId)
          singleOwner <- isOnlyOwner.result.map(_.head)
          _           <- if (singleOwner) DBIO.successful((): Unit) else DBIO.failed(IsNotTheOnlyStemmaOwner(stemmaId))

          _ <- qStemmas.filter(_.id === stemmaId).delete
        } yield ()).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  private def getOrCreatePerson(stemmaId: Long, userId: Long, pd: PersonDefinition)(implicit ec: ExecutionContext) = pd match {
    case ExistingPerson(id) =>
      for {
        _ <- checkPersonAccess(id, userId)
        _ <- checkStemmaCorrectness(id, stemmaId)
      } yield id

    case CreateNewPerson(name, birthDate, deathDate, bio) =>
      for {
        newPersonId <- (qPeople returning qPeople.map(_.id)) += Person(
                        name = name,
                        birthDate = birthDate,
                        deathDate = deathDate,
                        bio = bio,
                        stemmaId = stemmaId
                      )
        _ <- qPeopleOwners += PersonOwner(userId, newPersonId)
      } yield newPersonId
  }

  private def linkFamilyMembers(userId: Long, stemmaId: Long, familyId: Long, family: CreateFamily)(implicit ec: ExecutionContext) = {
    val parents  = (family.parent1 ++ family.parent2).toList
    val children = family.children

    val familyIsComplete = if ((parents.size + children.size) < 2) DBIO.failed(IncompleteFamily()) else DBIO.successful((): Unit)
    val noDuplicatedIds = (parents ++ children)
      .collect { case ExistingPerson(id) => id }
      .groupBy(identity)
      .values
      .find(_.size > 1)
      .map(ids => DBIO.failed(DuplicatedIds(ids.head)))
      .getOrElse(DBIO.successful((): Unit))

    //for some reason slick compiles an incorrect query when insertOrUpdate on the table where all the columns are
    //composite key, so this a way how to overcome the problem
    def createSpouseRelationIfNotExist(personId: Long) =
      for {
        exists <- qSpouses.filter(s => s.familyId === familyId && s.personId === personId).exists.result
        _      <- if (!exists) qSpouses += Spouse(personId, familyId) else DBIO.successful((): Unit)
      } yield ()

    def createChildRelationIfThereAreNoOtherFamilies(personId: Long) =
      for {
        childFamilies <- qChildren.filter(_.personId === personId).map(_.familyId).result
        _ <- if (childFamilies.isEmpty) qChildren += Child(personId, familyId)
            else if (childFamilies.size == 1 && childFamilies.head == familyId) DBIO.successful((): Unit)
            else DBIO.failed(ChildAlreadyBelongsToFamily(childFamilies.find(_ != familyId).get, personId))
      } yield ()

    for {
      _  <- familyIsComplete
      _  <- noDuplicatedIds
      ps <- DBIO sequence parents.map(p => getOrCreatePerson(stemmaId, userId, p))
      cs <- DBIO sequence children.map(p => getOrCreatePerson(stemmaId, userId, p))
      _  <- DBIO sequence ps.map(createSpouseRelationIfNotExist)
      _  <- DBIO sequence cs.map(createChildRelationIfThereAreNoOtherFamilies)
    } yield FamilyDescription(familyId, ps, cs, true)
  }

  private def unlinkFamilyMembers(familyId: Long)(implicit ec: ExecutionContext) =
    for {
      _ <- qSpouses.filter(_.familyId === familyId).delete
      _ <- qChildren.filter(_.familyId === familyId).delete
    } yield ()

  private def tryFindMatchingFamily(parents: Seq[PersonDefinition], userId: Long)(implicit ec: ExecutionContext) = {
    val existingParentsIds = parents.collect {
      case ExistingPerson(id) => id
    }

    def personFamilies(pId: Long, allPIds: Set[Long]) =
      (qSpouses.filter(_.personId === pId).map(_.familyId) join qSpouses on (_ === _.familyId))
        .result
        .map { families =>
          families
            .map {
              case (fid, spouse) => (fid, spouse.personId)
            }
            .groupBy(_._1)
            .collectFirst {
              case (fId, f) if f.map(_._2).toSet == allPIds => fId
            }
        }

    if (parents.isEmpty || parents.size != existingParentsIds.size) DBIO.successful(None)
    else
      for {
        maybeFamilyId <- personFamilies(existingParentsIds.head, existingParentsIds.toSet)
        _             <- if (maybeFamilyId.nonEmpty) checkFamilyAccess(maybeFamilyId.get, userId) else DBIO.successful((): Unit)
      } yield maybeFamilyId
  }

  override def createFamily(userId: Long, stemmaId: Long, family: CreateFamily): IO[StemmaError, FamilyDescription] =
    ZIO
      .fromFuture { implicit ec =>
        def createNewFamily =
          for {
            fid <- (qFamilies returning qFamilies.map(_.id)) += Family(stemmaId = stemmaId)
            _   <- qFamiliesOwners += FamilyOwner(userId, fid)
          } yield fid

        val query = (for {
          _             <- checkStemmaAccess(stemmaId, userId)
          maybeFamilyId <- tryFindMatchingFamily((family.parent1 ++ family.parent2).toSeq, userId)
          familyId      <- maybeFamilyId.map(DBIO.successful).getOrElse(createNewFamily)

          familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
        } yield familyDescr).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  override def updateFamily(userId: Long, familyId: Long, family: CreateFamily): IO[StemmaError, FamilyDescription] =
    ZIO
      .fromFuture { implicit ec =>
        val query = (for {
          _ <- checkFamilyAccess(familyId, userId)
          _ <- unlinkFamilyMembers(familyId)

          stemmaId    <- qFamilies.filter(_.id === familyId).map(_.stemmaId).result.head
          familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
        } yield familyDescr).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  override def removePerson(userId: Long, personId: Long): IO[StemmaError, Unit] =
    ZIO
      .fromFuture { implicit ec =>
        def dropEmptyFamilies = {
          val emptyFamilies = (qSpouses.map(x => (x.familyId, x.personId)) unionAll qChildren.map(x => (x.familyId, x.personId)))
            .groupBy(_._1)
            .map {
              case (q, agg) => (q, agg.length)
            }
            .filter(_._2 < 2)
            .map(_._1)
            .result

          emptyFamilies.flatMap(fs => qFamilies.filter(_.id inSet fs).delete)
        }

        val query = (for {
          _ <- checkPersonAccess(personId, userId)
          _ <- qPeople.filter(_.id === personId).delete
          _ <- dropEmptyFamilies
        } yield ()).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  override def removeFamily(userId: Long, familyId: Long): IO[StemmaError, Unit] =
    ZIO
      .fromFuture { implicit ec =>
        val query = (for {
          _ <- checkFamilyAccess(familyId, userId)
          _ <- unlinkFamilyMembers(familyId)
          _ <- qFamilies.filter(_.id === familyId).delete
        } yield ()).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  override def updatePerson(userId: Long, personId: Long, description: CreateNewPerson): IO[StemmaError, Unit] =
    ZIO
      .fromFuture { implicit ec =>
        val query = (for {
          _        <- checkPersonAccess(personId, userId)
          stemmaId <- qPeople.filter(_.id === personId).map(_.stemmaId).result.head
          _        <- qPeople.insertOrUpdate(Person(personId, description.name, description.birthDate, description.deathDate, description.bio, stemmaId))
        } yield ()).transactionally

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  override def stemma(userId: Long, stemmaId: Long): IO[StemmaError, DomainStemma] =
    ZIO
      .fromFuture { implicit ec =>
        val fs     = qFamilies.filter(_.stemmaId === stemmaId)
        val ownedF = qFamiliesOwners.filter(_.ownerId === userId)

        val parents  = (fs join qSpouses on (_.id === _.familyId) joinLeft ownedF on (_._1.id === _.familyId)).map { case ((f, m), o)  => (f.id, m.personId, o.isEmpty) }
        val children = (fs join qChildren on (_.id === _.familyId) joinLeft ownedF on (_._1.id === _.familyId)).map { case ((f, m), o) => (f.id, m.personId, o.isEmpty) }

        val stemmaQuery = for {
          pp <- (qPeople.filter(_.stemmaId === stemmaId) joinLeft qPeopleOwners.filter(_.ownerId === userId) on (_.id === _.personId)).result
          ps <- parents.result
          cs <- children.result
        } yield {
          val people = pp.map {
            case (tp, isOwner) => PersonDescription(tp.id, tp.name, tp.birthDate, tp.deathDate, tp.bio, isOwner.isEmpty)
          }

          val familyReadOnly = mutable.Map.empty[Long, Boolean]
          val familySpouses  = mutable.Map.empty[Long, mutable.Set[Long]].withDefaultValue(mutable.Set.empty)
          val familyChildren = mutable.Map.empty[Long, mutable.Set[Long]].withDefaultValue(mutable.Set.empty)

          ps.groupBy {
              case (fid, _, _) => fid
            }
            .foreach {
              case (fid, members) =>
                familySpouses(fid) = familySpouses(fid) ++ members.map(_._2)
                familyReadOnly(fid) = members.head._3
            }

          cs.groupBy {
              case (fid, _, _) => fid
            }
            .foreach {
              case (fid, members) =>
                familyChildren(fid) = familyChildren(fid) ++ members.map(_._2)
                familyReadOnly(fid) = members.head._3
            }

          val families = familyReadOnly.map {
            case (familyId, readOnly) => FamilyDescription(familyId, familySpouses(familyId).toList, familyChildren(familyId).toList, readOnly)
          }

          DomainStemma(people.toList, families.toList)
        }

        val query = for {
          _      <- checkStemmaAccess(stemmaId, userId)
          stemma <- stemmaQuery
        } yield stemma

        db run query
      }
      .refineOrDie {
        case stemmaError: StemmaError => stemmaError
      }

  private def selectDirectFamilies(initPersonId: Long) =
    sql"""
(
      WITH
      RECURSIVE "Ancestors" AS (
        SELECT "personId", "childFamily", "parentFamily" FROM "FamilyDescr" WHERE "personId" = $initPersonId
        UNION
        SELECT fd."personId", fd."childFamily", fd."parentFamily" FROM "FamilyDescr" fd INNER JOIN "Ancestors" anc ON anc."parentFamily" = fd."childFamily"
      )
      , "FamilyDescr" AS (
        SELECT coalesce(s."personId", c."personId") AS "personId", s."familyId" AS "childFamily", c."familyId" AS "parentFamily"
        FROM "Spouse" s FULL JOIN "Child" c on s."personId" = c."personId"
      )
      SELECT DISTINCT "parentFamily" AS familyId FROM "Ancestors" WHERE "parentFamily" IS NOT NULL
    ) UNION (
      with
      RECURSIVE "Dependees" AS (
        SELECT "personId", "childFamily", "parentFamily" FROM "FamilyDescr" WHERE "personId" =  $initPersonId
        UNION
        SELECT fd."personId", fd."childFamily", fd."parentFamily" FROM "FamilyDescr" fd INNER JOIN "Dependees" dep ON dep."childFamily" = fd."parentFamily"
      )
      , "FamilyDescr" AS (
        SELECT coalesce(s."personId", c."personId") AS "personId", s."familyId" AS "childFamily", c."familyId" AS "parentFamily"
        FROM "Spouse" s FULL JOIN "Child" c on s."personId" = c."personId"
      )
      SELECT DISTINCT "childFamily" AS familyId FROM "Dependees" WHERE "childFamily" IS NOT NULL
    )
    """.as[Long]

  override def chown(userId: Long, stemmaId: Long, targetPersonId: Long): UIO[ChownEffect] =
    ZIO.fromFuture { implicit ec =>
      val action = (for {
        relatedFamilies <- selectDirectFamilies(targetPersonId)
        affectedPeople  <- (qSpouses.filter(_.familyId inSet relatedFamilies).map(_.personId) union qChildren.filter(_.familyId inSet relatedFamilies).map(_.personId)).result
        _               <- DBIO.sequence(relatedFamilies.map(fid => qFamiliesOwners += FamilyOwner(userId, fid)))
        _               <- DBIO.sequence(affectedPeople.map(pid => qPeopleOwners += PersonOwner(userId, pid)))
        _               <- qStemmaOwners += StemmaOwner(userId, stemmaId)
      } yield ChownEffect(relatedFamilies, affectedPeople)).transactionally

      db run action
    }.orDie

  override def ownsPerson(userId: Long, personId: Long): UIO[Boolean] =
    ZIO.fromFuture { implicit ec =>
      db.run(
        qPeopleOwners.filter(po => po.ownerId === userId && po.personId === personId).exists.result
      )
    }.orDie
}

class ConfiguredStemmaService extends SlickStemmaService {
  import api._
  override val db = Database.forConfig("dbConfig")
}
