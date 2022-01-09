package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription}
import io.github.salamahin.stemma.response.Stemma
import org.scalatest.Inside.inside
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class StemmaRepositoryAddFamilySuite extends AnyFunSuite with StemmaFamilySuite with Matchers {
  test("can create a family when without parents") {
    repo.newFamily(FamilyDescription(None, None, johnDoe :: janeDoe :: Nil))

    val Stemma(people, families) = repo.stemma()
    val ids                      = nameToId(people)

    people.size shouldBe 2
    families.size shouldBe 1

    families.head.parents shouldBe empty
    families.head.children should contain only (ids(johnDoe.name), ids(janeDoe.name))
  }

  test("can create a family without children") {
    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil))

    val Stemma(people, families) = repo.stemma()
    val ids                      = nameToId(people)

    people.size shouldBe 2
    families.size shouldBe 1

    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
    families.head.children shouldBe empty
  }

  test("creating a family with zero or one member yields errors") {
    repo.newFamily(FamilyDescription(None, None, Nil)) shouldBe Left(IncompleteFamily())
    repo.newFamily(FamilyDescription(Some(johnDoe), None, Nil)) shouldBe Left(IncompleteFamily())
    repo.newFamily(FamilyDescription(None, None, janeDoe :: Nil)) shouldBe Left(IncompleteFamily())
  }

  test("can create a family with parents and children") {
    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil))

    val Stemma(people, families) = repo.stemma()
    val ids                      = nameToId(people)

    people.size shouldBe 3
    families.size shouldBe 1

    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
    families.head.children should contain only ids(joshDoe.name)
  }

  test("will raise an error if both parents are already married on each other") {
    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)).getOrElse(throw new IllegalStateException())

    val Stemma(people, _) = repo.stemma()
    val ids               = nameToId(people)
    val johnDoeId         = ExistingPersonId(ids(johnDoe.name))
    val janeDoeId         = ExistingPersonId(ids(janeDoe.name))

    inside(repo.newFamily(FamilyDescription(Some(johnDoeId), Some(janeDoeId), Nil))) {
      case Left(CompositeError(SuchFamilyAlreadyExist(familyId, p1, p2) :: Nil)) =>
        familyId shouldBe existentFamilyId
        p1 shouldBe ids(johnDoe.name)
        p2 shouldBe ids(janeDoe.name)
    }
  }

  test("will raise an error if some of children are already belongs to a different families") {
    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)).getOrElse(throw new IllegalStateException())

    val Stemma(people, _) = repo.stemma()
    val ids               = nameToId(people)
    val joshDoeId         = ids(joshDoe.name)

    inside(repo.newFamily(FamilyDescription(Some(jamesDoe), Some(jillDoe), ExistingPersonId(joshDoeId) :: Nil))) {
      case Left(CompositeError(ChildBelongsToDifferentFamily(childId, familyId) :: Nil)) =>
        childId shouldBe joshDoeId
        familyId shouldBe existentFamilyId
    }
  }
}
