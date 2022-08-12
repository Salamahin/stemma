package io.github.salamahin.stemma.tinkerpop

import slick.jdbc.JdbcProfile

import java.time.LocalDate

trait Tables {
  this: JdbcProfile =>
  import api._

  case class StemmaUser(id: Long, email: String)
  case class Stemma(id: Long, name: String)
  case class Person(id: Long, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], stemmaId: Long)
  case class Family(id: Long, stemmaId: Long)
  case class FamilyOwner(ownerId: Long, resourceId: Long)
  case class PersonOwner(ownerId: Long, resourceId: Long)
  case class StemmaOwner(ownerId: Long, resourceId: Long)
  case class PersonFamily(personId: Long, familyId: Long, tpe: String)

  val stemmaUsers    = TableQuery[StemmaUsers]
  val stemmas        = TableQuery[Stemmas]
  val people         = TableQuery[People]
  val families       = TableQuery[Families]
  val personFamilies = TableQuery[PersonFamilies]
  val familiesOwners = TableQuery[FamiliesOwners]
  val peopleOwners   = TableQuery[PeopleOwners]
  val stemmaOwners   = TableQuery[StemmaOwners]

  class StemmaUsers(tag: Tag) extends Table[StemmaUser](tag, "StemmaUsers") {
    def id    = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def email = column[String]("email", O.Unique)

    def * = (id, email).mapTo[StemmaUser]
  }

  class Stemmas(tag: Tag) extends Table[Stemma](tag, "Stemmas") {
    def id   = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def name = column[String]("name")

    override def * = (id, name).mapTo[Stemma]
  }

  class People(tag: Tag) extends Table[Person](tag, "Person") {
    def id        = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def name      = column[String]("name")
    def birthDate = column[Option[LocalDate]]("birthDate")
    def deathDate = column[Option[LocalDate]]("deathDate")
    def bio       = column[Option[String]]("bio")
    def stemmaId  = column[Long]("stemmaId")

    def fkPersonStemma = foreignKey("FK_Person_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (id, name, birthDate, deathDate, bio, stemmaId).mapTo[Person]
  }

  class Families(tag: Tag) extends Table[Family](tag, "Family") {
    def id       = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def stemmaId = column[Long]("stemmaId")

    def fkFamilyStemma = foreignKey("FK_Family_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (id, stemmaId).mapTo[Family]
  }

  class PersonFamilies(tag: Tag) extends Table[PersonFamily](tag, "PersonFamily") {
    def personId = column[Long]("personId")
    def familyId = column[Long]("familyId")
    def tpe      = column[String]("type")

    def pk = primaryKey("pk", (personId, familyId))

    def fkPersonFamiliesPerson = foreignKey("FK_PersonFamilies_Person", personId, people)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)
    def fkPersonFamiliesFamily = foreignKey("FK_PersonFamilies_Family", familyId, families)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (personId, familyId, tpe).mapTo[PersonFamily]
  }

  class FamiliesOwners(tag: Tag) extends Table[FamilyOwner](tag, "FamilyOwner") {
    def ownerId  = column[Long]("ownerId")
    def familyId = column[Long]("familyId")

    def pk = primaryKey("pk", (ownerId, familyId))

    def fkOwnerUser      = foreignKey("FK_FamilyOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)
    def fkResourceFamily = foreignKey("FK_FamilyOwner_Family", familyId, families)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (ownerId, familyId).mapTo[FamilyOwner]
  }

  class PeopleOwners(tag: Tag) extends Table[PersonOwner](tag, "PersonOwner") {
    def ownerId  = column[Long]("ownerId")
    def personId = column[Long]("personId")

    def pk = primaryKey("pk", (ownerId, personId))

    def fkOwnerUser      = foreignKey("FK_PersonOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)
    def fkResourcePerson = foreignKey("FK_PersonOwner_Person", personId, people)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (ownerId, personId).mapTo[PersonOwner]
  }

  class StemmaOwners(tag: Tag) extends Table[StemmaOwner](tag, "StemmaOwner") {
    def ownerId  = column[Long]("ownerId")
    def stemmaId = column[Long]("stemmaId")

    def pk = primaryKey("pk", (ownerId, stemmaId))

    def fkOwnerUser      = foreignKey("FK_StemmaOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)
    def fkResourcePerson = foreignKey("FK_StemmaOwner_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Restrict)

    override def * = (ownerId, stemmaId).mapTo[StemmaOwner]
  }
}
