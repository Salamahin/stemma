package io.github.salamahin.stemma

import io.github.salamahin.stemma.gremlin.{GraphConfig, GremlinBasedStemmaRepository}
import io.github.salamahin.stemma.request.PersonRequest
import io.github.salamahin.stemma.response.Stemma
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate
import java.util.UUID

class StemmaRepositoryTest extends AnyFunSuite with Matchers with BeforeAndAfterEach {
  private var repo: StemmaRepository = _

  override def beforeEach(): Unit = {
    super.beforeEach()
    repo = new GremlinBasedStemmaRepository(GraphConfig.newGraph())
  }

  class FamilyTree(stemma: Stemma) {
    private val personIdToFamilyId = stemma.spouses.groupBy(_.source).view.mapValues(_.map(_.target))

    def spouses(personId: String) = {
      val families = personIdToFamilyId(personId)
      stemma
        .spouses
        .filter(s => families.contains(s.target))
        .map(_.source)
        .filter(_ != personId)
    }

    def children(personId: String) = {
      val families = personIdToFamilyId(personId)
      stemma
        .children
        .filter(c => families.contains(c.source))
        .map(_.target)
    }
  }

  private val johnDoe  = PersonRequest("John Doe", Some(LocalDate.parse("1900-01-01")), Some(LocalDate.parse("2000-01-01")))
  private val janeDoe  = PersonRequest("Jane Doe", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  private val jamesDoe = PersonRequest("James Doe", None, None)
  private val joshDoe  = PersonRequest("James Doe", None, None)

  test("can add a person") {
    val id = repo.newPerson(johnDoe)
    repo.stemma().people.map(_.id) should contain(id)
  }

  test("previously added person can be updated") {
    val id = repo.newPerson(johnDoe)
    repo.updatePerson(id, janeDoe)

    val people = repo.stemma().people
    people.size should be(1)

    val jd = people.head
    jd.id should be(id)
    jd.name should be(janeDoe.name)
    jd.birthDate should be(janeDoe.birthDate)
    jd.deathDate should be(janeDoe.deathDate)
  }

  test("modification attempt of non-existing person yields an exception") {
    val id        = UUID.randomUUID().toString
    val Left(err) = repo.updatePerson(id, johnDoe)
    err should be(NoSuchPersonId(id))
  }

  test("a single person can make family if he has children") {
    val parentId = repo.newPerson(johnDoe)
    val childId  = repo.newPerson(janeDoe)
    repo
      .newFamily(parentId)
      .foreach(repo.addChild(_, childId))

    val tree = new FamilyTree(repo.stemma())
    tree.spouses(parentId) shouldBe empty
    tree.children(parentId) should contain only childId
  }

  test("two people can make family without children") {
    val parent1Id = repo.newPerson(johnDoe)
    val parent2Id = repo.newPerson(janeDoe)

    repo.newFamily(parent1Id, parent2Id)

    val tree = new FamilyTree(repo.stemma())
    tree.spouses(parent1Id) should contain only parent2Id
    tree.spouses(parent2Id) should contain only parent1Id
  }

  test("when removing a person his spouse relations are also removed") {
    val parent1Id = repo.newPerson(johnDoe)
    val parent2Id = repo.newPerson(janeDoe)
    repo.newFamily(parent1Id, parent2Id)
    repo.removePerson(parent1Id)

    val Stemma(_, _, spouses, _) = repo.stemma()
    spouses.map(_.source) should not contain parent1Id
  }

  test("if the only child removed from a family where there is a single parent, than family is removed") {
    val parentId = repo.newPerson(johnDoe)
    val childId  = repo.newPerson(janeDoe)
    val familyId = repo.newFamily(parentId).getOrElse(throw new IllegalStateException("Failed to create a family"))
    repo.addChild(familyId, childId)

    repo.removeChild(familyId, childId)

    val Stemma(people, families, spouses, children) = repo.stemma()
    families shouldBe empty
    spouses shouldBe empty
    children shouldBe empty
    people.map(_.id) should contain only (parentId, childId)
  }

  test("if the only child removed from a family where there are 2 parents than family is not removed") {
    val parent1Id = repo.newPerson(johnDoe)
    val parent2Id = repo.newPerson(janeDoe)
    val childId   = repo.newPerson(joshDoe)

    val familyId = repo.newFamily(parent1Id, parent2Id).getOrElse(throw new IllegalStateException("Failed to create a family"))
    repo.addChild(familyId, childId)

    repo.removeChild(familyId, childId)

    val stemma @ Stemma(people, _, _, _) = repo.stemma()
    people.map(_.id) should contain only (parent1Id, parent2Id, childId)

    val familyTree = new FamilyTree(stemma)
    familyTree.spouses(parent1Id) should contain only parent2Id
    familyTree.spouses(parent2Id) should contain only parent1Id
    familyTree.children(parent1Id) shouldBe empty
    familyTree.children(parent2Id) shouldBe empty
  }

  test("generation of a child is greater than max generation of his parents") {
    val johnId  = repo.newPerson(johnDoe)
    val janeId  = repo.newPerson(janeDoe)
    val joshId  = repo.newPerson(joshDoe)
    val jamesId = repo.newPerson(jamesDoe)

    val johnsFamilyId = repo.newFamily(johnId).getOrElse(throw new IllegalStateException("Failed to create a family"))
    repo.addChild(johnsFamilyId, janeId)

    val janeJoshFamilyId = repo.newFamily(janeId, joshId).getOrElse(throw new IllegalStateException("Failed to create a family"))
    repo.addChild(janeJoshFamilyId, jamesId)

    val Stemma(people, _, _, _) = repo.stemma()
    people.find(_.id == jamesId).map(_.generation) shouldBe Some(2)
  }

  test("when removing a family all family relations are removed as well") {
    val johnId        = repo.newPerson(johnDoe)
    val janeId        = repo.newPerson(janeDoe)
    val johnsFamilyId = repo.newFamily(johnId).getOrElse(throw new IllegalStateException("Failed to create a family"))
    repo.addChild(johnsFamilyId, janeId)

    repo.removeFamily(johnsFamilyId)

    val Stemma(people, families, spouses, children) = repo.stemma()
    people.map(_.id) should contain only (johnId, janeId)
    people.map(_.generation).distinct should contain only 0

    families shouldBe empty
    spouses shouldBe empty
    children shouldBe empty
  }
}
