package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain
import io.github.salamahin.stemma.domain.{ExistingPersonId, FamilyDescription, PersonDefinition, PersonDescription}
import io.github.salamahin.stemma.domain.PersonDescription

import java.time.LocalDate

trait Requests {
  val johnsBirthDay = LocalDate.parse("1900-01-01")
  val johnsDeathDay = LocalDate.parse("2000-01-01")

  val createJohn           = PersonDescription("John", Some(johnsBirthDay), Some(johnsDeathDay))
  val createJane           = PersonDescription("Jane", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  val createJames          = PersonDescription("James", None, None)
  val createJake           = PersonDescription("Jake", None, None)
  val createJuly           = PersonDescription("July", None, None)
  val createJosh           = PersonDescription("Josh", None, None)
  val createJill           = PersonDescription("Jill", None, None)
  def existing(id: Long) = ExistingPersonId(id)

  def family(parents: PersonDefinition*)(children: PersonDefinition*) = parents.toList match {
    case Nil             => FamilyDescription(None, None, children.toList)
    case p1 :: Nil       => domain.FamilyDescription(Some(p1), None, children.toList)
    case p1 :: p2 :: Nil => domain.FamilyDescription(Some(p1), Some(p2), children.toList)
    case _               => throw new IllegalArgumentException("too many parents")
  }

}
