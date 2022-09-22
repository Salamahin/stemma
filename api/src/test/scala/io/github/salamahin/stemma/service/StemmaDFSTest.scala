package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.{FamilyDescription, Stemma}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers

import java.util.concurrent.atomic.AtomicInteger

class StemmaDFSTest extends AnyFunSuite with Matchers {
  private val familyIdGenerator = new AtomicInteger(0)

  private def nextFamily(parents: String*)(children: String*) =
    FamilyDescription(familyIdGenerator.incrementAndGet().toString, parents.toList, children.toList, false)

  private def composedStemma(fd: FamilyDescription*) = new StemmaDFS(Stemma(Nil, fd.toList))

  test("minimal stemma composition has no cycles") {
    composedStemma(
      nextFamily("mother", "father")("child")
    ).hasCycles() shouldBe false
  }

  test("detects cycles") {
    composedStemma(
      nextFamily("Ekaterina", "Ivan")(),
      nextFamily("Ivan", "Marina")("Petr"),
      nextFamily("Petr", "Ekaterina")(),
    ).hasCycles() shouldBe true
  }

  test("more complicated stemma with no cycles") {
    composedStemma(
      nextFamily("Marina", "Ivan")("Petr"),
      nextFamily("Petr")("Ekaterina"),
      nextFamily("Aleksei", "Ekaterina")("Eva"),
    ).hasCycles() shouldBe false
  }
}
