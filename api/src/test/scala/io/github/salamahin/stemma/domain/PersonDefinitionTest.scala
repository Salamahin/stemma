package io.github.salamahin.stemma.domain

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

class PersonDefinitionTest extends AnyFunSuite with Matchers {
  import PersonDefinition._
  import zio.json._

  test("parses existing person") {
    """{"ExistingPerson": {"id": "personId"}}""".fromJson[PersonDefinition] should be(Right(ExistingPerson("personId")))
  }

  test("parses new person") {
    """{"CreateNewPerson": {"name": "personName"}}""".fromJson[PersonDefinition] should be(Right(CreateNewPerson("personName", None, None, None)))
  }
}
