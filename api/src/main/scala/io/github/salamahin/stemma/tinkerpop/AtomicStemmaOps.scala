package io.github.salamahin.stemma.tinkerpop

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaRepository.relations

import java.sql.Connection
import scala.util.Using
import scala.util.Using.Releasable

/*
  Stemma
  ------
  id
  name


  User
  ------
  id
  email


  Person
  ------
  id
  name
  birthDate
  deathDate
  bio
  stemmaId


  Family
  -------
  id
  stemmaId


  StemmaOwner
  -------
  resourceId
  ownerId


  FamilyOwner
  -------
  resourceId
  ownerId


  PersonOwner
  -------
  resourceId
  ownerId


  PersonFamily
  -------
  familyId
  personId
  type
 */

class AtomicStemmaOps {
  import cats.syntax.either._

  private val isStemmaOwner = "select * from StemmaOwner where stemmaId = ? and ownerId = ?"
  private val isPersonOwner = "select * from PersonOwner where personId = ? and ownerId = ?"
  private val isFamilyOwner = "select * from FamilyOwner where familyId = ? and ownerId = ?"

  private val removeStemma = "delete from Stemma where id = ?"
  private val removePerson = "delete from Person where id = ?"
  private val removeFamily = "delete from Family where id = ?"

  private val createPerson = "insert into Person values(?, ?, ?, ?)"
  private val updatePerson = "update Person set name = ?, birthDate = ?, deathDate = ?, bio = ? where id = ?"

  private val createUser      = "insert into User values(?, ?)"
  private val findUserByEmail = "select id from User where email = ?"

  private val removePersonToFamily = "delete from PersonFamily where familyId = ?"
  private val addPersonToStemma    = "insert into PersonFamily values (?, ?)"

  private val createFamily = "insert into Family values (?)"

  private def attempt[T: Releasable, K](t: T)(use: T => Either[StemmaError, K]) =
    Using(t) { use }
      .toEither
      .leftMap(exc => UnknownError(exc): StemmaError)
      .flatten

  def listStemmas(conn: Connection, ownerId: String): Either[NoSuchUserId, List[StemmaDescription]] = ???

  def removeStemma(conn: Connection, stemmaId: String, userId: String): Either[StemmaError, Unit] = ???

  def stemma(conn: Connection, stemmaId: String, userId: String): Stemma = ???

  def updatePerson(conn: Connection, id: String, description: CreateNewPerson): Either[NoSuchPersonId, Unit] = ???

  def newFamily(conn: Connection, stemmaId: String): String = ???

  def findFamily(conn: Connection, parent1: String, parent2: String) = ???

  def findFamily(conn: Connection, parent1: String) = ???

  def getOrCreateUser(conn: Connection, email: String): User = ???

  def chown(conn: Connection, startPersonId: String): ChownEffect = ???

  def newStemma(conn: Connection, name: String): String = ???

  def removeChildRelation(conn: Connection, familyId: String, personId: String): Either[StemmaError, Unit] = ???

  def removeSpouseRelation(conn: Connection, familyId: String, personId: String): Either[StemmaError, Unit] = ???

  def newPerson(conn: Connection, stemmaId: String, descr: CreateNewPerson): String = ???

  def makeChildRelation(conn: Connection, familyId: String, personId: String): Either[StemmaError, Unit] = ???
//    setRelation(ts, personId, familyId, relations.childOf)(childShouldBelongToSingleFamily)

  def makeSpouseRelation(conn: Connection, familyId: String, personId: String): Either[StemmaError, Unit] = ???

  def removeFamily(conn: Connection, id: String): Either[NoSuchFamilyId, Unit] = ???

  def removePerson(conn: Connection, id: String): Either[NoSuchPersonId, Unit] = ???

  def describePerson(conn: Connection, id: String): Either[StemmaError, ExtendedPersonDescription] = {
    val query = s"""
        |SELECT p.id, p.name, p.birhtDate, p.deathDate, p.bio, p.stemmaId, childF.familyId, spouseF.familyIds, o.ownersIds
        |FROM Person p
        |LEFT OUTER JOIN PeronFamily childF
        |LEFT OUTER JOIN (SELECT personId, array_agg(familyId) AS familyIds GROUP BY personId WHERE type = ${relations.spouseOf}) spouseF
        |LEFT OUTER JOIN (SELECT resourceId, array_agg(ownerId) AS ownersIds GROUP BY resourceId) o
        |ON (p.id = childF.personId AND childF.type = ${relations.childOf})
        |AND (p.id = spouseF.personId)
        |WHERE p.id = ?""".stripMargin

    attempt(conn prepareStatement query) { q =>
      q.setString(0, id)

      attempt(q.executeQuery()) { rs =>
        if (!rs.next()) Left(NoSuchPersonId(id))
        else
          Right(
            ExtendedPersonDescription(
              CreateNewPerson(
                rs.getString("p.name"),
                Option(rs.getDate("p.birthDate")).map(_.toLocalDate),
                Option(rs.getDate("p.deathDate")).map(_.toLocalDate),
                Option(rs.getString("p.bio"))
              ),
              Option(rs.getString("childF.familyId")),
              rs.getArray("spouseF.familyIds").asInstanceOf[Array[String]].toList,
              rs.getString("p.stemmaId"),
              rs.getArray("o.ownersIds").asInstanceOf[Array[String]].toList
            )
          )
      }
    }
  }

  def describeFamily(conn: Connection, id: String): Either[StemmaError, ExtendedFamilyDescription] = {
    val query = s"""
        |SELECT
        |  f.id,
        |  f.stemmaId,
        |  array_remove(array_agg(CASE WHEN p.type = ${relations.childOf} THEN p.id ELSE NULL END), NULL) AS children_ids,
        |  array_remove(array_agg(CASE WHEN p.type = ${relations.spouseOf} THEN p.id ELSE NULL END), NULL) AS parent_ids
        |FROM Family f 
        |LEFT OUTER JOIN PersonFamily p 
        |ON f.id = p.familyId 
        |GROUP BY f.id, f.stemmaId 
        |WHERE f.id = ?""".stripMargin

    attempt(conn prepareStatement query) { q =>
      q.setString(0, id)

      attempt(q.executeQuery()) { rs =>
        var stemmaId: String       = null
        var parents: List[String]  = Nil
        var children: List[String] = Nil

        if (!rs.next()) Left(NoSuchFamilyId(id))
        else
          Right(
            ExtendedFamilyDescription(
              rs.getString("f.id"),
              rs.getArray("childrenIds").asInstanceOf[Array[String]].toList,
              rs.getArray("parent_ids").asInstanceOf[Array[String]].toList,
              rs.getString("f.stemmaId")
            )
          )
      }
    }
  }

  def isFamilyOwner(conn: Connection, userId: String, familyId: String): Either[StemmaError, Boolean] =
    isResourceOwner(conn, userId, familyId, "FamilyOwner")

  def isPersonOwner(conn: Connection, userId: String, personId: String): Either[StemmaError, Boolean] =
    isResourceOwner(conn, userId, personId, "PersonOwner")

  def isStemmaOwner(conn: Connection, userId: String, stemmaId: String): Either[StemmaError, Boolean] = {
    isResourceOwner(conn, userId, stemmaId, "StemmaOwner")
  }

  def makeExistingFamilyOwner(conn: Connection, userId: String, familyId: String): Either[StemmaError, Unit] =
    makeOwner(conn, userId, familyId, "FamilyOwner", "family")

  def makeExistingPersonOwner(conn: Connection, userId: String, personId: String): Either[StemmaError, Unit] =
    makeOwner(conn, userId, personId, "PersonOwner", "person")

  def makeExistingGraphOwner(conn: Connection, userId: String, stemmaId: String): Either[StemmaError, Unit] = {
    makeOwner(conn, userId, stemmaId, "StemmaOwner", "stemma")
  }

  private def isResourceOwner(conn: Connection, userId: String, resourceId: String, ownershipTable: String) = {
    val query = s"""
         |SELECT u.id, o.ownerId
         |FROM (select id from User where id = ?) u
         |LEFT OUTER JOIN (SELECT ownerId FROM $ownershipTable WHERE ownerId = ? AND resourceId = ?) o
         |ON u.id = o.ownerId""".stripMargin

    attempt(conn prepareStatement query) { q =>
      q.setString(0, userId)
      q.setString(1, userId)
      q.setString(0, resourceId)

      attempt(q.executeQuery()) { rs =>
        if (!rs.next()) Left(NoSuchUserId(userId))
        else Right(rs.getString("o.ownerId") != null)
      }
    }
  }

  private def makeOwner(conn: Connection, userId: String, resourceId: String, resourceTable: String, resourceType: String) = {
    attempt(conn prepareStatement s"insert into $resourceTable values(?, ?)") { q =>
      q.setString(0, resourceId)
      q.setString(1, userId)

      if (q.execute()) Right() else Left(IsAlreadyAnOwner(userId, resourceId, resourceType))
    }
  }
}

private object AtomicStemmaOps {
  object relations {
    val childOf  = "childOf"
    val spouseOf = "spouseOf"
  }
}
