package io.github.salamahin.stemma.service
import io.github.salamahin.stemma.domain.{Stemma => DomainStemma, _}
import io.github.salamahin.stemma.tinkerpop.Tables
import slick.jdbc.JdbcProfile
import zio.{IO, ZIO}

import scala.collection.mutable
import scala.collection.mutable.ListBuffer
import scala.concurrent.ExecutionContext

abstract class SlickStemmaService extends Tables {
  this: JdbcProfile =>
  import api._

  private val spouse = "spouse"
  private val child  = "child"

  val db: backend.DatabaseDef

  private def checkStemmaAccess(stemmaId: String, userId: String)(implicit ec: ExecutionContext) = {
    val ownedStemma = stemmaOwners.filter(so => so.ownerId === userId && so.stemmaId === stemmaId)

    for {
      isOwner <- ownedStemma.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToStemmaDenied(stemmaId))
    } yield ()
  }

  private def checkPersonAccess(personId: String, userId: String)(implicit ec: ExecutionContext) = {
    val ownedPeople = peopleOwners.filter(po => po.ownerId === userId && po.personId === personId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToPersonDenied(personId))
    } yield ()
  }

  private def checkFamilyAccess(familyId: String, userId: String)(implicit ec: ExecutionContext) = {
    val ownedPeople = familiesOwners.filter(fo => fo.ownerId === userId && fo.familyId === familyId)

    for {
      isOwner <- ownedPeople.exists.result
      _       <- if (isOwner) DBIO.successful((): Unit) else DBIO.failed(AccessToFamilyDenied(familyId))
    } yield ()
  }

  def createStemma(userId: String, name: String) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      newStemmaId <- (stemmas returning stemmas.map(_.id)) += Stemma(name = name)
      _           <- stemmaOwners += StemmaOwner(userId, newStemmaId)
    } yield newStemmaId).transactionally

    db run query
  }

  def listOwnedStemmas(userId: String) = ZIO.fromFuture { implicit ec =>
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

  def removeStemma(userId: String, stemmaId: String) = ZIO.fromFuture { implicit ec =>
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

  private def getOrCreatePerson(stemmaId: String, userId: String, pd: PersonDefinition)(implicit ec: ExecutionContext): DBIO[String] = pd match {
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

  private def linkFamilyMembers(userId: String, stemmaId: String, familyId: String, family: CreateFamily)(implicit ec: ExecutionContext) = {
    val parents  = (family.parent1 ++ family.parent2).map(p => getOrCreatePerson(stemmaId, userId, p)).toList
    val children = family.children.map(p => getOrCreatePerson(stemmaId, userId, p))

    for {
      ps <- DBIO sequence parents
      cs <- DBIO sequence children
      _  <- DBIO sequence ps.map(p => peopleFamilies += PersonFamily(p, familyId, spouse))
      _  <- DBIO sequence cs.map(c => peopleFamilies += PersonFamily(c, familyId, child))
    } yield FamilyDescription(familyId, ps, cs, true)
  }

  private def unlinkFamilyMembers(familyId: String)(implicit ec: ExecutionContext) = {
    peopleFamilies.filter(_.familyId === familyId).delete
  }

  def createFamily(userId: String, stemmaId: String, family: CreateFamily) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _           <- checkStemmaAccess(userId, stemmaId)
      familyId    <- (families returning families.map(_.id)) += Family(stemmaId = stemmaId)
      _           <- familiesOwners += FamilyOwner(userId, familyId)
      familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
    } yield familyDescr).transactionally

    db run query
  }

  def updateFamily(userId: String, familyId: String, family: CreateFamily) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkFamilyAccess(familyId, userId)
      _ <- unlinkFamilyMembers(familyId)

      stemmaId    <- families.filter(_.id === familyId).map(_.stemmaId).result.head
      familyDescr <- linkFamilyMembers(userId, stemmaId, familyId, family)
    } yield familyDescr).transactionally

    db run query
  }

  def removePerson(userId: String, personId: String) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkPersonAccess(personId, userId)
      _ <- people.filter(_.id === personId).delete
    } yield ()).transactionally

    db run query
  }

  def removeFamily(userId: String, familyId: String) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _ <- checkFamilyAccess(familyId, userId)
      _ <- unlinkFamilyMembers(familyId)
      _ <- families.filter(_.id === familyId).delete
    } yield ()).transactionally

    db run query
  }

  def updatePerson(userId: String, personId: String, description: CreateNewPerson) = ZIO.fromFuture { implicit ec =>
    val query = (for {
      _        <- checkPersonAccess(personId, userId)
      stemmaId <- people.filter(_.id === personId).map(_.stemmaId).result.head
      _        <- people.insertOrUpdate(Person(personId, description.name, description.birthDate, description.deathDate, description.bio, stemmaId))
    } yield ()).transactionally

    db run query
  }

  def stemma(userId: String, stemmaId: String) = ZIO.fromFuture { implicit ec =>
    val joined =
      (families.filter(_.stemmaId === stemmaId) join peopleFamilies on (_.id === _.familyId)
        join people on (_._2.personId === _.id)
        joinLeft peopleOwners.filter(_.ownerId === userId) on (_._2.id === _.personId)
        joinLeft familiesOwners.filter(_.ownerId === userId) on (_._1._1._1.id === _.familyId))

    val stemmaQuery = joined
      .result
      .map { data =>
        val familyReadOnly = mutable.Map.empty[String, Boolean]
        val familySpouses  = mutable.Map.empty[String, mutable.ListBuffer[String]].withDefaultValue(ListBuffer.empty)
        val familyChildren = mutable.Map.empty[String, mutable.ListBuffer[String]].withDefaultValue(ListBuffer.empty)
        val peopleAcc      = mutable.ListBuffer.empty[PersonDescription]

        data.foreach {
          case ((((f, pf), p), po), fo) =>
            peopleAcc += PersonDescription(p.id, p.name, p.birthDate, p.deathDate, p.bio, po.isEmpty)

            familyReadOnly(f.id) = fo.isEmpty

            if (pf.tpe == spouse) familySpouses(f.id).addOne(p.id)
            else familyChildren(f.id).addOne(p.id)
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

  def chown(toUserId: String, targetPersonId: String): Unit = ???

  def ownsPerson(userId: String, personId: String) = ZIO.fromFuture { implicit ec =>
    db.run(
      peopleOwners.filter(po => po.ownerId === userId && po.personId === personId).exists.result
    )
  }
}
