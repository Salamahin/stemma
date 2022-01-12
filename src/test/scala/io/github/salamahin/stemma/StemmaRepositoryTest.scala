package io.github.salamahin.stemma

import io.github.salamahin.stemma.gremlin.GraphConfig
import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription, PersonDescription}
import io.github.salamahin.stemma.response.{Person, Stemma}
import org.scalatest.BeforeAndAfterEach
import org.scalatest.Inside.inside
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

class StemmaRepositoryTest extends AnyFunSuite with BeforeAndAfterEach with Matchers {
  override def beforeEach(): Unit = {
    super.beforeEach()
//    repo = new GremlinBasedStemmaRepository(GraphConfig.newGraph())
  }

  private val johnDoe  = PersonDescription("John Doe", Some(LocalDate.parse("1900-01-01")), Some(LocalDate.parse("2000-01-01")))
  private val janeDoe  = PersonDescription("Jane Doe", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  private val jamesDoe = PersonDescription("James Doe", None, None)
  private val joshDoe  = PersonDescription("James Doe", None, None)
  private val jillDoe  = PersonDescription("Jill Doe", None, None)

  private def nameToId(people: List[Person]) = people.map(p => p.name -> p.id).toMap

//  test("can create a family when without parents") {
//    repo.newFamily(FamilyDescription(None, None, johnDoe :: janeDoe :: Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 2
//    families.size shouldBe 1
//
//    families.head.parents shouldBe empty
//    families.head.children should contain only (ids(johnDoe.name), ids(janeDoe.name))
//  }
//
//  test("can create a family without children") {
//    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 2
//    families.size shouldBe 1
//
//    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
//    families.head.children shouldBe empty
//  }
//
//  test("creating a family with zero or one member yields errors") {
//    repo.newFamily(FamilyDescription(None, None, Nil)) shouldBe Left(IncompleteFamily())
//    repo.newFamily(FamilyDescription(Some(johnDoe), None, Nil)) shouldBe Left(IncompleteFamily())
//    repo.newFamily(FamilyDescription(None, None, janeDoe :: Nil)) shouldBe Left(IncompleteFamily())
//  }
//
//  test("can create a family with parents and children") {
//    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 3
//    families.size shouldBe 1
//
//    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
//    families.head.children should contain only ids(joshDoe.name)
//  }
//
//  test("will raise an error if both parents are already married on each other") {
//    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)).getOrElse(throw new IllegalStateException())
//
//    val Stemma(people, _) = repo.stemma()
//    val ids               = nameToId(people)
//    val johnDoeId         = ExistingPersonId(ids(johnDoe.name))
//    val janeDoeId         = ExistingPersonId(ids(janeDoe.name))
//
//    inside(repo.newFamily(FamilyDescription(Some(johnDoeId), Some(janeDoeId), Nil))) {
//      case Left(CompositeError(SuchFamilyAlreadyExist(familyId, p1, p2) :: Nil)) =>
//        familyId shouldBe existentFamilyId
//        p1 shouldBe ids(johnDoe.name)
//        p2 shouldBe ids(janeDoe.name)
//    }
//  }
//
//  test("will raise an error if some of children are already belongs to a different families") {
//    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)).getOrElse(throw new IllegalStateException())
//
//    val Stemma(people, _) = repo.stemma()
//    val ids               = nameToId(people)
//    val joshDoeId         = ids(joshDoe.name)
//
//    inside(repo.newFamily(FamilyDescription(Some(jamesDoe), Some(jillDoe), ExistingPersonId(joshDoeId) :: Nil))) {
//      case Left(CompositeError(ChildBelongsToDifferentFamily(childId, familyId) :: Nil)) =>
//        childId shouldBe joshDoeId
//        familyId shouldBe existentFamilyId
//    }
//  }
//
//  test("existent family can be updated") {
//    val family1 = FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)
//
//    val family1Id = repo.newFamily(family1).getOrElse(throw new IllegalStateException())
//    var ids       = nameToId(repo.stemma().people)
//    val janeDoeId = ids(janeDoe.name)
//
//    val family2 = FamilyDescription(Some(jillDoe), None, ExistingPersonId(janeDoeId) :: joshDoe :: Nil)
//    repo.updateFamily(family1Id, family2)
//    ids = nameToId(repo.stemma().people)
//
//    val Stemma(people, families) = repo.stemma()
//    people.map(_.name) should contain only (johnDoe.name, janeDoe.name, jillDoe.name, joshDoe.name)
//    families.size shouldBe 1
//    families.head.parents should contain only ids(jillDoe.name)
//    families.head.children should contain only (ids(janeDoe.name), ids(joshDoe.name))
//  }
//
//  test("can remove a family") {
//    val family   = FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)
//    val familyId = repo.newFamily(family).getOrElse(throw new IllegalStateException())
//
//    repo.removeFamilyIfExist(familyId)
//    val Stemma(people, families) = repo.stemma()
//
//    people.map(_.name) should contain only (johnDoe.name, janeDoe.name, joshDoe.name)
//    families shouldBe empty
//  }
//
//  test("family can be described") {
//    val family   = FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)
//    val familyId = repo.newFamily(family).getOrElse(throw new IllegalStateException())
//
//    val Stemma(_, families) = repo.stemma()
//
//    val FamilyDescription(Some(ExistingPersonId(p1)), Some(ExistingPersonId(p2)), ExistingPersonId(c1) :: Nil) =
//      repo.describeFamily(familyId).getOrElse(throw new IllegalStateException())
//
//    families.head.parents should contain only (p1, p2)
//    families.head.children should contain only c1
//  }
}
