package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription}
import io.github.salamahin.stemma.response.Stemma
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class StemmaRepositoryUpdateFamilySuite extends AnyFunSuite with StemmaFamilySuite with Matchers {
  test("existent family can be updated") {
    val family1 = FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)

    val family1Id = repo.newFamily(family1).getOrElse(throw new IllegalStateException())
    var ids       = nameToId(repo.stemma().people)
    val janeDoeId = ids(janeDoe.name)

    val family2 = FamilyDescription(Some(jillDoe), None, ExistingPersonId(janeDoeId) :: joshDoe :: Nil)
    repo.updateFamily(family1Id, family2)
    ids = nameToId(repo.stemma().people)

    val Stemma(people, families) = repo.stemma()
    people.map(_.name) should contain only (johnDoe.name, janeDoe.name, jillDoe.name, joshDoe.name)
    families.size shouldBe 1
    families.head.parents should contain only ids(jillDoe.name)
    families.head.children should contain only (ids(janeDoe.name), ids(joshDoe.name))
  }
}
