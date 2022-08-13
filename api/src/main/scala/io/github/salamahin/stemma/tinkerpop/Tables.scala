package io.github.salamahin.stemma.tinkerpop

import slick.jdbc.JdbcProfile

import java.time.LocalDate

trait Tables {
  this: JdbcProfile =>
  import api._

  case class StemmaUser(id: Long = 0, email: String)
  case class Stemma(id: Long = 0, name: String)
  case class Person(id: Long = 0, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate], bio: Option[String], stemmaId: Long)
  case class Family(id: Long = 0, stemmaId: Long)
  case class FamilyOwner(ownerId: Long, resourceId: Long)
  case class PersonOwner(ownerId: Long, resourceId: Long)
  case class StemmaOwner(ownerId: Long, resourceId: Long)
  case class PersonFamily(personId: Long, familyId: Long, tpe: String)
  case class Spouse(personId: Long, familyId: Long)
  case class Child(personId: Long, familyId: Long)

  val qStemmaUsers    = TableQuery[TStemmaUsers]
  val qStemmas        = TableQuery[TStemmas]
  val qPeople         = TableQuery[TPeople]
  val qFamilies       = TableQuery[TFamilies]
  val qPeopleFamilies = TableQuery[TPersonFamilies]
  val qFamiliesOwners = TableQuery[TFamiliesOwners]
  val qPeopleOwners   = TableQuery[TPeopleOwners]
  val qStemmaOwners   = TableQuery[TStemmaOwners]
  val qSpouses        = TableQuery[TSpouses]
  val qChildren       = TableQuery[TChildren]

  class TStemmaUsers(tag: Tag) extends Table[StemmaUser](tag, "StemmaUsers") {
    def id    = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def email = column[String]("email", O.Unique)

    override def * = (id, email).mapTo[StemmaUser]
  }

  class TStemmas(tag: Tag) extends Table[Stemma](tag, "Stemmas") {
    def id   = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def name = column[String]("name")

    override def * = (id, name).mapTo[Stemma]
  }

  class TPeople(tag: Tag) extends Table[Person](tag, "Person") {
    def id        = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def name      = column[String]("name")
    def birthDate = column[Option[LocalDate]]("birthDate")
    def deathDate = column[Option[LocalDate]]("deathDate")
    def bio       = column[Option[String]]("bio")
    def stemmaId  = column[Long]("stemmaId")

    def fkPersonStemma = foreignKey("FK_Person_Stemma", stemmaId, qStemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (id, name, birthDate, deathDate, bio, stemmaId).mapTo[Person]
  }

  class TFamilies(tag: Tag) extends Table[Family](tag, "Family") {
    def id       = column[Long]("id", O.PrimaryKey, O.AutoInc)
    def stemmaId = column[Long]("stemmaId")

    def fkFamilyStemma = foreignKey("FK_Family_Stemma", stemmaId, qStemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (id, stemmaId).mapTo[Family]
  }

  class TPersonFamilies(tag: Tag) extends Table[PersonFamily](tag, "PersonFamily") {
    def personId = column[Long]("personId")
    def familyId = column[Long]("familyId")
    def tpe      = column[String]("type")

    def pk = primaryKey("pk", (personId, familyId))

    def fkPersonFamiliesPerson = foreignKey("FK_PersonFamilies_Person", personId, qPeople)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkPersonFamiliesFamily = foreignKey("FK_PersonFamilies_Family", familyId, qFamilies)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (personId, familyId, tpe).mapTo[PersonFamily]
  }

  class TFamiliesOwners(tag: Tag) extends Table[FamilyOwner](tag, "FamilyOwner") {
    def ownerId  = column[Long]("ownerId")
    def familyId = column[Long]("familyId")

    def pk = primaryKey("PK_FamilyOwner", (ownerId, familyId))

    def fkOwnerUser      = foreignKey("FK_FamilyOwner_User", ownerId, qStemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourceFamily = foreignKey("FK_FamilyOwner_Family", familyId, qFamilies)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, familyId).mapTo[FamilyOwner]
  }

  class TPeopleOwners(tag: Tag) extends Table[PersonOwner](tag, "PersonOwner") {
    def ownerId  = column[Long]("ownerId")
    def personId = column[Long]("personId")

    def pk = primaryKey("PK_PersonOwner", (ownerId, personId))

    def fkOwnerUser      = foreignKey("FK_PersonOwner_User", ownerId, qStemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourcePerson = foreignKey("FK_PersonOwner_Person", personId, qPeople)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, personId).mapTo[PersonOwner]
  }

  class TStemmaOwners(tag: Tag) extends Table[StemmaOwner](tag, "StemmaOwner") {
    def ownerId  = column[Long]("ownerId")
    def stemmaId = column[Long]("stemmaId")

    def pk = primaryKey("PK_StemmaOwner", (ownerId, stemmaId))

    def fkOwnerUser      = foreignKey("FK_StemmaOwner_User", ownerId, qStemmaUsers)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkResourcePerson = foreignKey("FK_StemmaOwner_Stemma", stemmaId, qStemmas)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (ownerId, stemmaId).mapTo[StemmaOwner]
  }

  class TSpouses(tag: Tag) extends Table[Spouse](tag, "Spouse") {
    def personId = column[Long]("personId")
    def familyId = column[Long]("familyId")

    def pk = primaryKey("PK_Spouse", (personId, familyId))

    def fkSpousePerson = foreignKey("FK_Spouse_Person", personId, qPeople)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkSpouseFamily = foreignKey("FK_Spouse_Family", familyId, qFamilies)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (personId, familyId).mapTo[Spouse]
  }

  class TChildren(tag: Tag) extends Table[Child](tag, "Child") {
    def personId = column[Long]("personId", O.PrimaryKey)
    def familyId = column[Long]("familyId")

    def fkChildPerson = foreignKey("FK_Child_Person", personId, qPeople)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)
    def fkChildFamily = foreignKey("FK_Child_Family", familyId, qFamilies)(_.id, ForeignKeyAction.Cascade, ForeignKeyAction.Cascade)

    override def * = (personId, familyId).mapTo[Child]
  }
}
