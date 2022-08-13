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

  def createSchema = ZIO.fromFuture { implicit ec => db run (stemmaUsers.schema ++ stemmas.schema ++ people.schema ++ families.schema ++ peopleFamilies.schema ++ familiesOwners.schema ++ peopleOwners.schema ++ stemmaOwners.schema).create }

  def close() = ZIO.succeed(db.close())

  def getOrCreateUser(email: String) = ZIO.fromFuture { implicit ec =>
    val userId = stemmaUsers returning stemmaUsers.map(_.id)

    val query = (for {
      maybeUserId <- stemmaUsers.filter(_.email === email).map(_.id).result.headOption
      userId      <- maybeUserId.map(id => DBIO.successful(id)).getOrElse(userId += StemmaUser(email = email))
    } yield User(userId, email)).transactionally

    db run query
  }

  private def checkStemmaAccess(stemmaId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedStemma = stemmaOwners.filter(so => so.ownerId === userId && so.stemmaId === stemmaId)

    for {
      isOwner <- ownedStemma.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToStemmaDenied(stemmaId))
    } yield ()
  }

  private def checkPersonAccess(personId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedPeople = peopleOwners.filter(po => po.ownerId === userId && po.personId === personId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToPersonDenied(personId))
    } yield ()
  }

  private def checkFamilyAccess(familyId: Long, userId: Long)(implicit ec: ExecutionContext) = {
    val ownedPeople = familiesOwners.filter(fo => fo.ownerId === userId && fo.familyId === familyId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToFamilyDenied(familyId))
    } yield ()
  }

  def createStemma(userId: Long, name: String) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      newStemmaId <- (stemmas returning stemmas.map(_.id)) += Stemma(name = name)
      _           <- stemmaOwners += StemmaOwner(userId, newStemmaId)
    } yield newStemmaId).transactionally

    db run query
  }

  def listOwnedStemmas(userId: Long) = ZIO.fromFuture { implicit ec =>
    val ownedStemmas = stemmaOwners.filter(_.ownerId === userId).map(_.stemmaId)

    val ownersCounted = (ownedStemmas join stemmaOwners on (_ === _.stemmaId))
      .groupBy(_._1)
      .map {
        case (stemmaId, owners) => (stemmaId, owners.map(_._2.ownerId).size)
      }

    val stemmasWithRemovableFlag = (stemmas join ownersCounted on ((l, r) => l.id === r._1))
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
    val isOnlyOwner = stemmaOwners
      .filter(_.stemmaId === stemmaId)
      .groupBy(_.stemmaId)
      .map {
        case (_, groups) => groups.length === 1
      }

    val query = (for {
      _           <- checkStemmaAccess(stemmaId, userId)
      singleOwner <- isOnlyOwner.result.map(_.head)
      _           <- if (singleOwner) DBIO.successful((): Unit) else DBIO.failed(IsNotTheOnlyStemmaOwner(stemmaId))

      _ <- stemmas.filter(_.id === stemmaId).delete
    } yield ()).transactionally

    db run query
  }

  private def getOrCreatePerson(stemmaId: Long, userId: Long, pd: PersonDefinition)(implicit ec: ExecutionContext) = pd match {
    case ExistingPerson(id) => checkPersonAccess(id, userId).map(_ => id)

    case CreateNewPerson(name, birthDate, deathDate, bio) =>
      for {
        newPersonId <- (people returning people.map(_.id)) += Person(
                        name = name,
                        birthDate = birthDate,
                        deathDate = deathDate,
                        bio = bio,
                        stemmaId = stemmaId
                      )
        _ <- peopleOwners += PersonOwner(userId, newPersonId)
      } yield newPersonId
  }

  private def linkFamilyMembers(userId: Long, stemmaId: Long, familyId: Long, family: CreateFamily)(implicit ec: ExecutionContext) = {
    val parents = (family.parent1 ++ family.parent2).toList
    val children = family.children

    val familyIsComplete = if ((parents.size + children.size) < 2) DBIO.failed(IncompleteFamily()) else DBIO.successful((): Unit)
    val noDuplicatedIds = (parents ++ children)
      .collect { case ExistingPerson(id) => id }
      .groupBy(identity)
      .values
      .find(_.size > 1)
      .map(ids => DBIO.failed(DuplicatedIds(ids.head)))
      .getOrElse(DBIO.successful((): Unit))

    for {
      _ <- familyIsComplete
      _ <- noDuplicatedIds
      ps <- DBIO sequence parents.map(p => getOrCreatePerson(stemmaId, userId, p))
      cs <- DBIO sequence children.map(p => getOrCreatePerson(stemmaId, userId, p))
      _ <- DBIO sequence ps.map(p => peopleFamilies.insertOrUpdate(PersonFamily(p, familyId, spouse)))
      _ <- DBIO sequence cs.map(c => peopleFamilies.insertOrUpdate(PersonFamily(c, familyId, child)))
    } yield FamilyDescription(familyId, ps, cs, true)
  }

  private def unlinkFamilyMembers(familyId: Long)(implicit ec: ExecutionContext) = {
    peopleFamilies.filter(_.familyId === familyId).delete
  }

  private def tryFindMatchingFamily(parents: Seq[PersonDefinition], userId: Long)(implicit ec: ExecutionContext) = {
    val existingParentsIds = parents.collect {
      case ExistingPerson(id) => id
    }

    def familyWithSingleParent = {
      for {
        familyId <- peopleFamilies.filter(_.personId === existingParentsIds.head).map(_.familyId).result.head
        _        <- checkFamilyAccess(familyId, userId)
      } yield Some(familyId)
    }

    def familyWithBothParents = {
      for {
        familyId <- peopleFamilies
                     .filter(_.personId === existingParentsIds(0))
                     .join(peopleFamilies.filter(_.personId === existingParentsIds(1)))
                     .on(_.familyId === _.familyId)
                     .map {
                       case (fo, _) => fo.familyId
                     }
                     .result
                     .head
        _ <- checkFamilyAccess(familyId, userId)
      } yield Some(familyId)
    }

    if (existingParentsIds.size == parents.size && parents.size == 1) familyWithSingleParent
    else if (existingParentsIds.size == parents.size && parents.size == 2) familyWithBothParents
    else DBIO.successful(None)
  }

  def createFamily(userId: Long, stemmaId: Long, family: CreateFamily) = ZIO.fromFuture { implicit ec =>
    def createNewFamily =
      for {
        fid <- (families returning families.map(_.id)) += Family(stemmaId = stemmaId)
        _   <- familiesOwners += FamilyOwner(userId, fid)
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

      stemmaId    <- families.filter(_.id === familyId).map(_.stemmaId).result.head
      familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
    } yield familyDescr).transactionally

    db run query
  }

  def removePerson(userId: Long, personId: Long) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkPersonAccess(personId, userId)
      _ <- people.filter(_.id === personId).delete
    } yield ()).transactionally

    db run query
  }

  def removeFamily(userId: Long, familyId: Long) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkFamilyAccess(familyId, userId)
      _ <- unlinkFamilyMembers(familyId)
      _ <- families.filter(_.id === familyId).delete
    } yield ()).transactionally

    db run query
  }

  def updatePerson(userId: Long, personId: Long, description: CreateNewPerson) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _        <- checkPersonAccess(personId, userId)
      stemmaId <- people.filter(_.id === personId).map(_.stemmaId).result.head
      _        <- people.insertOrUpdate(Person(personId, description.name, description.birthDate, description.deathDate, description.bio, stemmaId))
    } yield ()).transactionally

    db run query
  }

  def stemma(userId: Long, stemmaId: Long) = ZIO.fromFuture { implicit ec =>
    val joined =
      (families.filter(_.stemmaId === stemmaId) join peopleFamilies on (_.id === _.familyId)
        join people on (_._2.personId === _.id)
        joinLeft peopleOwners.filter(_.ownerId === userId) on (_._2.id === _.personId)
        joinLeft familiesOwners.filter(_.ownerId === userId) on (_._1._1._1.id === _.familyId))

    val stemmaQuery = joined
      .result
      .map { data =>
        val familyReadOnly = mutable.Map.empty[Long, Boolean]
        val familySpouses  = mutable.Map.empty[Long, mutable.Set[Long]].withDefaultValue(mutable.Set.empty)
        val familyChildren = mutable.Map.empty[Long, mutable.Set[Long]].withDefaultValue(mutable.Set.empty)
        val peopleAcc      = mutable.ListBuffer.empty[PersonDescription]

        data.foreach {
          case ((((f, pf), p), po), fo) =>
            peopleAcc += PersonDescription(p.id, p.name, p.birthDate, p.deathDate, p.bio, po.isEmpty)

            familyReadOnly(f.id) = fo.isEmpty

            if (pf.tpe == spouse) familySpouses(pf.familyId) = familySpouses(pf.familyId) + pf.personId
            else familyChildren(pf.familyId) = familyChildren(pf.familyId) + pf.personId
        }

        val families = familyReadOnly.map {
          case (familyId, readOnly) => FamilyDescription(familyId, familySpouses(familyId).toList, familyChildren(familyId).toList, readOnly)
        }

        DomainStemma(peopleAcc.toList, families.toList)
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
      peopleOwners.filter(po => po.ownerId === userId && po.personId === personId).exists.result
    )
  }
}
