package io.github.salamahin.stemma

import io.github.salamahin.stemma.gremlin.{GraphConfig, GremlinBasedStemmaRepository}
import io.github.salamahin.stemma.request.{FamilyRequest, PersonRequest}
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

class StemmaRepositoryTest extends AnyFunSuite with Matchers with BeforeAndAfterEach {
  private var stemma: StemmaRepository = _

  override def beforeEach(): Unit = {
    super.beforeEach()
    stemma = new GremlinBasedStemmaRepository(GraphConfig.newGraph())
  }

  private val johnDoe  = PersonRequest("John Doe", Some(LocalDate.parse("1900-01-01")), Some(LocalDate.parse("2000-01-01")))
  private val janeDoe  = PersonRequest("Jane Doe", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  private val jamesDoe = PersonRequest("James Doe", None, None)
  private val julyDoe  = PersonRequest("July Doe", None, None)
  private val joshDoe  = PersonRequest("Josh Doe", None, None)

  test("can add a person") {
    val id = stemma.newPerson(johnDoe)
    stemma.stemma().people.map(_.id) should contain(id)
  }

  test("previously added person can be updated") {
    val id = stemma.newPerson(johnDoe)
    stemma.updatePerson(id, janeDoe)

    val people = stemma.stemma().people
    people.size should be(1)

    val jd = people.head
    jd.id should be(id)
    jd.name should be(janeDoe.name)
    jd.birthDate should be(janeDoe.birthDate)
    jd.deathDate should be(janeDoe.deathDate)
  }

  test("modification attempt of non-existing person yields an exception") {
    val Left(err) = stemma.updatePerson("aaa", johnDoe)
    err should be(NoSuchPersonId("aaa"))
  }

  test("a single without children cant form a family") {
    val parentId = stemma.newPerson(johnDoe)
    val Left(err) = stemma.newFamily(FamilyRequest(parentId, None, Nil))
    ???
  }

  test("when removing a person his child/spouse relations are also removed") {
    ???
  }
}
