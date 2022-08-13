package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{Stemma => DomainStemma, _}
import io.github.salamahin.stemma.tinkerpop.Tables
import slick.jdbc.PostgresProfile
import zio.{Task, ZIO}

import scala.collection.mutable
import scala.concurrent.ExecutionContext

class SlickStemmaService(jdbcConfiguration: JdbcConfiguration) extends Tables with PostgresProfile {
  import api._

  private val spouse = "spouse"
  private val child  = "child"

  private val db = Database.forURL(url = jdbcConfiguration.jdbcUrl, user = jdbcConfiguration.jdbcUser, password = jdbcConfiguration.jdbcPassword)

  def createSchema = ZIO.fromFuture { implicit ec =>
    db run (qStemmaUsers.schema ++ qStemmas.schema ++ qPeople.schema ++ qFamilies.schema ++ qFamiliesOwners.schema ++ qPeopleOwners.schema ++ qStemmaOwners.schema ++ qSpouses.schema ++ qChildren.schema).create
  }

  def close() = ZIO.succeed(db.close())

  def getOrCreateUser(email: String) = ZIO.fromFuture { implicit ec =>
    val userId = qStemmaUsers returning qStemmaUsers.map(_.id)

    val query = (for {
      maybeUserId <- qStemmaUsers.filter(_.email === email).map(_.id).result.headOption
      userId      <- maybeUserId.map(id => DBIO.successful(id)).getOrElse(userId += StemmaUser(email = email))
    } yield User(userId, email)).transactionally

    db run query
  }

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

  def createStemma(userId: Long, name: String) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      newStemmaId <- (qStemmas returning qStemmas.map(_.id)) += Stemma(name = name)
      _           <- qStemmaOwners += StemmaOwner(userId, newStemmaId)
    } yield newStemmaId).transactionally

    db run query
  }

  def listOwnedStemmas(userId: Long) = ZIO.fromFuture { implicit ec =>
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
  }

  def removeStemma(userId: Long, stemmaId: Long) = ZIO.fromFuture { implicit ec =>
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

  private def getOrCreatePerson(stemmaId: Long, userId: Long, pd: PersonDefinition)(implicit ec: ExecutionContext) = pd match {
    case ExistingPerson(id) => checkPersonAccess(id, userId).map(_ => id)

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

  def createFamily(userId: Long, stemmaId: Long, family: CreateFamily) = ZIO.fromFuture { implicit ec =>
    def createNewFamily =
      for {
        fid <- (qFamilies returning qFamilies.map(_.id)) += Family(stemmaId = stemmaId)
        _   <- qFamiliesOwners += FamilyOwner(userId, fid)
      } yield fid

    val query = (for {
      _             <- checkStemmaAccess(userId, stemmaId)
      maybeFamilyId <- tryFindMatchingFamily((family.parent1 ++ family.parent2).toSeq, userId)
      familyId      <- maybeFamilyId.map(DBIO.successful).getOrElse(createNewFamily)

      familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
    } yield familyDescr).transactionally

    db run query
  }

  def updateFamily(userId: Long, familyId: Long, family: CreateFamily) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkFamilyAccess(familyId, userId)
      _ <- unlinkFamilyMembers(familyId)

      stemmaId    <- qFamilies.filter(_.id === familyId).map(_.stemmaId).result.head
      familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
    } yield familyDescr).transactionally

    db run query
  }

  def removePerson(userId: Long, personId: Long) = ZIO.fromFuture { implicit ec =>
    def dropEmptyFamilies = {
      val emptyFamilies = (qSpouses.map(x => (x.familyId, x.personId)) union qChildren.map(x => (x.familyId, x.personId)))
        .groupBy(_._1)
        .map {
          case (q, agg) => (q, agg.size)
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

  def removeFamily(userId: Long, familyId: Long) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkFamilyAccess(familyId, userId)
      _ <- unlinkFamilyMembers(familyId)
      _ <- qFamilies.filter(_.id === familyId).delete
    } yield ()).transactionally

    db run query
  }

  def updatePerson(userId: Long, personId: Long, description: CreateNewPerson) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _        <- checkPersonAccess(personId, userId)
      stemmaId <- qPeople.filter(_.id === personId).map(_.stemmaId).result.head
      _        <- qPeople.insertOrUpdate(Person(personId, description.name, description.birthDate, description.deathDate, description.bio, stemmaId))
    } yield ()).transactionally

    db run query
  }

  def stemma(userId: Long, stemmaId: Long) = ZIO.fromFuture { implicit ec =>
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

      ps
        .groupBy {
          case (fid, memberId, familyReadOnly) => fid
        }
        .foreach {
          case (fid, members) =>
            familySpouses(fid) = familySpouses(fid) ++ members.map(_._2)
            familyReadOnly(fid) = members.head._3
        }

      cs
        .groupBy {
          case (fid, memberId, familyReadOnly) => fid
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

  def chown(toUserId: Long, targetPersonId: Long): Task[ChownEffect] = ???

  def ownsPerson(userId: Long, personId: Long) = ZIO.fromFuture { implicit ec =>
    db.run(
      qPeopleOwners.filter(po => po.ownerId === userId && po.personId === personId).exists.result
    )
  }
}
