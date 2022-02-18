package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain
import io.github.salamahin.stemma.domain.{ExistingPerson, CreateFamily, PersonDefinition, CreateNewPerson}

import java.time.LocalDate

trait Requests {
  val johnsBirthDay = LocalDate.parse("1900-01-01")
  val johnsDeathDay = LocalDate.parse("2000-01-01")

  val createJohn           = CreateNewPerson("John", Some(johnsBirthDay), Some(johnsDeathDay))
  val createJane           = CreateNewPerson("Jane", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  val createJames          = CreateNewPerson("James", None, None)
  val createJake           = CreateNewPerson("Jake", None, None)
  val createJuly           = CreateNewPerson("July", None, None)
  val createJosh           = CreateNewPerson("Josh", None, None)
  val createJill           = CreateNewPerson("Jill", None, None)
  val createJeff           = CreateNewPerson("Jeff", None, None)
  def existing(id: String) = ExistingPerson(id)

  def family(parents: PersonDefinition*)(children: PersonDefinition*) = parents.toList match {
    case Nil             => CreateFamily(None, None, children.toList)
    case p1 :: Nil       => domain.CreateFamily(Some(p1), None, children.toList)
    case p1 :: p2 :: Nil => domain.CreateFamily(Some(p1), Some(p2), children.toList)
    case _               => throw new IllegalArgumentException("too many parents")
  }

}
