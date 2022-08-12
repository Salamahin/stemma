package io.github.salamahin.stemma.tinkerpop

import slick.jdbc.JdbcProfile

import java.time.LocalDate

trait Tables {
  this: JdbcProfile =>
  import api._

  case class StemmaUser(id: String = "", email: String)
  case class Stemma(id: String = "", name: String)
  case class Person(id: String = "", name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], stemmaId: String)
  case class Family(id: String = "", stemmaId: String)
  case class FamilyOwner(ownerId: String, resourceId: String)
  case class PersonOwner(ownerId: String, resourceId: String)
  case class StemmaOwner(ownerId: String, resourceId: String)
  case class PersonFamily(personId: String, familyId: String, tpe: String)

  val stemmaUsers    = TableQuery[StemmaUsers]
  val stemmas        = TableQuery[Stemmas]
  val people         = TableQuery[People]
  val families       = TableQuery[Families]
  val peopleFamilies = TableQuery[PersonFamilies]
  val familiesOwners = TableQuery[FamiliesOwners]
  val peopleOwners   = TableQuery[PeopleOwners]
  val stemmaOwners   = TableQuery[StemmaOwners]

  class StemmaUsers(tag: Tag) extends Table[StemmaUser](tag, "StemmaUsers") {
    def id    = column[String]("id", O.PrimaryKey, O.AutoInc)
    def email = column[String]("email", O.Unique)

    def * = (id, email).mapTo[StemmaUser]
  }

  class Stemmas(tag: Tag) extends Table[Stemma](tag, "Stemmas") {
    def id   = column[String]("id", O.PrimaryKey, O.AutoInc)
    def name = column[String]("name")

    override def * = (id, name).mapTo[Stemma]
  }

  class People(tag: Tag) extends Table[Person](tag, "Person") {
    def id        = column[String]("id", O.PrimaryKey, O.AutoInc)
    def name      = column[String]("name")
    def birthDate = column[Option[LocalDate]]("birthDate")
    def deathDate = column[Option[LocalDate]]("deathDate")
    def bio       = column[Option[String]]("bio")
    def stemmaId  = column[String]("stemmaId")

    def fkPersonStemma = foreignKey("FK_Person_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (id, name, birthDate, deathDate, bio, stemmaId).mapTo[Person]
  }

  class Families(tag: Tag) extends Table[Family](tag, "Family") {
    def id       = column[String]("id", O.PrimaryKey, O.AutoInc)
    def stemmaId = column[String]("stemmaId")

    def fkFamilyStemma = foreignKey("FK_Family_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (id, stemmaId).mapTo[Family]
  }

  class PersonFamilies(tag: Tag) extends Table[PersonFamily](tag, "PersonFamily") {
    def personId = column[String]("personId")
    def familyId = column[String]("familyId")
    def tpe      = column[String]("type")

    def pk = primaryKey("pk", (personId, familyId))

    def fkPersonFamiliesPerson = foreignKey("FK_PersonFamilies_Person", personId, people)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkPersonFamiliesFamily = foreignKey("FK_PersonFamilies_Family", familyId, families)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (personId, familyId, tpe).mapTo[PersonFamily]
  }

  class FamiliesOwners(tag: Tag) extends Table[FamilyOwner](tag, "FamilyOwner") {
    def ownerId  = column[String]("ownerId")
    def familyId = column[String]("familyId")

    def pk = primaryKey("pk", (ownerId, familyId))

    def fkOwnerUser      = foreignKey("FK_FamilyOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourceFamily = foreignKey("FK_FamilyOwner_Family", familyId, families)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, familyId).mapTo[FamilyOwner]
  }

  class PeopleOwners(tag: Tag) extends Table[PersonOwner](tag, "PersonOwner") {
    def ownerId  = column[String]("ownerId")
    def personId = column[String]("personId")

    def pk = primaryKey("pk", (ownerId, personId))

    def fkOwnerUser      = foreignKey("FK_PersonOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourcePerson = foreignKey("FK_PersonOwner_Person", personId, people)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, personId).mapTo[PersonOwner]
  }

  class StemmaOwners(tag: Tag) extends Table[StemmaOwner](tag, "StemmaOwner") {
    def ownerId  = column[String]("ownerId")
    def stemmaId = column[String]("stemmaId")

    def pk = primaryKey("pk", (ownerId, stemmaId))

    def fkOwnerUser      = foreignKey("FK_StemmaOwner_User", ownerId, stemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourcePerson = foreignKey("FK_StemmaOwner_Stemma", stemmaId, stemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, stemmaId).mapTo[StemmaOwner]
  }
}
