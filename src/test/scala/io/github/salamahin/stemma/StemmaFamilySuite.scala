package io.github.salamahin.stemma

import io.github.salamahin.stemma.gremlin.{GraphConfig, GremlinBasedStemmaRepository}
import io.github.salamahin.stemma.request.PersonDescription
import io.github.salamahin.stemma.response.Person
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funsuite.AnyFunSuite

import java.time.LocalDate

trait StemmaFamilySuite extends BeforeAndAfterEach {
  this: AnyFunSuite =>

  var repo: StemmaRepository = _

  override def beforeEach(): Unit = {
    super.beforeEach()
    repo = new GremlinBasedStemmaRepository(GraphConfig.newGraph())
  }

  val johnDoe  = PersonDescription("John Doe", Some(LocalDate.parse("1900-01-01")), Some(LocalDate.parse("2000-01-01")))
  val janeDoe  = PersonDescription("Jane Doe", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  val jamesDoe = PersonDescription("James Doe", None, None)
  val joshDoe  = PersonDescription("James Doe", None, None)
  val jillDoe  = PersonDescription("Jill Doe", None, None)

  def nameToId(people: List[Person]) = people.map(p => p.name -> p.id).toMap
}
