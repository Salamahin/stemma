package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription, PersonDefinition, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Person, Stemma}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.{CompositeError, DuplicatedIds, IncompleteFamily}
import zio.ZIO
import zio.test.Assertion._
import zio.test.{DefaultRunnableSpec, assert, assertTrue}

import java.time.LocalDate

object BasicStemmaRepositoryTest extends DefaultRunnableSpec {
  object render {
    def unapply(stemma: Stemma) = {
      val Stemma(people: List[Person], families: List[Family]) = stemma
      val personById                                           = people.map(p => (p.id, p)).toMap

      val descr = families
        .map {
          case Family(_, parents, children) =>
            val parentNames   = parents.map(personById).map(_.name).sorted.mkString("(", ", ", ")")
            val childrenNames = children.map(personById).map(_.name).sorted.mkString("(", ", ", ")")

            s"$parentNames parentsOf $childrenNames"
        }

      Some(descr)
    }
  }

  private val johnsBirthDay = LocalDate.parse("1900-01-01")
  private val johnsDeathDay = LocalDate.parse("2000-01-01")

  private val createJohn           = PersonDescription("John", Some(johnsBirthDay), Some(johnsDeathDay))
  private val createJane           = PersonDescription("Jane", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  private val createJames          = PersonDescription("James", None, None)
  private val createJake           = PersonDescription("Jake", None, None)
  private val createJuly           = PersonDescription("July", None, None)
  private val createJosh           = PersonDescription("Josh", None, None)
  private val createJill           = PersonDescription("Jill", None, None)
  private def existing(id: String) = ExistingPersonId(id)

  private def family(parents: PersonDefinition*)(children: PersonDefinition*) = parents.toList match {
    case Nil             => FamilyDescription(None, None, children.toList)
    case p1 :: Nil       => FamilyDescription(Some(p1), None, children.toList)
    case p1 :: p2 :: Nil => FamilyDescription(Some(p1), Some(p2), children.toList)
    case _               => throw new IllegalArgumentException("too many parents")
  }

  private def newStemmaService = ZIO.environment[STEMMA].map(_.get).provideCustomLayer(graph.newGraph >>> stemma.basic)

  private val canCreateFamily = testM("can create different family with both parents and several children") {
    for {
      s <- newStemmaService

      _ <- s.newFamily(family(createJane, createJohn)(createJill, createJosh))
      _ <- s.newFamily(family(createJohn)(createJosh))
      _ <- s.newFamily(family(createJane, createJohn)())
      _ <- s.newFamily(family()(createJane, createJohn))

      render(families) <- s.stemma()
    } yield assert(families) {
      hasSameElements(
        "(Jane, John) parentsOf (Jill, Josh)" ::
          "(John) parentsOf (Josh)" ::
          "(Jane, John) parentsOf ()" ::
          "() parentsOf (Jane, John)" ::
          Nil
      )
    }
  }

  private val cantCreateFamilyOfSingleParent = testM("there cant be a family with a single parent and no children") {
    for {
      s   <- newStemmaService
      err <- s.newFamily(family(createJohn)()).flip
    } yield assertTrue(err == CompositeError(IncompleteFamily() :: Nil))
  }

  private val cantCreateFamilyOfSingleChild = testM("there cant be a family with no parents and a single child") {
    for {
      s   <- newStemmaService
      err <- s.newFamily(family()(createJill)).flip
    } yield assertTrue(err == CompositeError(IncompleteFamily() :: Nil))
  }

  private val duplicatedIdsForbidden = testM("cant update a family when there are duplicated ids in members") {
    for {
      s                                               <- newStemmaService
      Family(familyId, jamesId :: Nil, jillId :: Nil) <- s.newFamily(family(createJames)(createJill))
      err                                             <- s.updateFamily(familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == CompositeError(DuplicatedIds(jamesId :: Nil) :: Nil))
  }

  private val canRemovePerson = testM("when removing a person hist child & spouse relations are removed as well") {
    for {
      s <- newStemmaService

      Family(_, _, jillId :: _ :: Nil) <- s.newFamily(family(createJane, createJohn)(createJill, createJames))
      _                                <- s.newFamily(family(existing(jillId), createJosh)(createJake))
      _                                <- s.removePerson(jillId)

      render(families) <- s.stemma()
    } yield assert(families)(
      hasSameElements(
        "(Jane, John) parentsOf (James)" ::
          "(Josh) parentsOf (Jake)" ::
          Nil
      )
    )
  }

  private val leavingSingleMemberOfFamilyDropsTheFamily = testM("when the only member of family left the family is removed") {
    for {
      s <- newStemmaService

      Family(_, _, jillId :: Nil) <- s.newFamily(family(createJane)(createJill))
      Family(_, joshId :: Nil, _) <- s.newFamily(family(createJosh)(createJames))

      _ <- s.removePerson(jillId)
      _ <- s.removePerson(joshId)

      Stemma(people, families) <- s.stemma()
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "James" :: Nil))
  }

  private val canUpdateExistingPerson = testM("can update existing person") {
    for {
      s <- newStemmaService

      Family(_, janeId :: Nil, _) <- s.newFamily(family(createJane)(createJill))

      _ <- s.updatePerson(janeId, createJohn)

      st @ Stemma(people, _) <- s.stemma()
      render(families)       = st
    } yield assertTrue(families == List("(John) parentsOf (Jill)")) && assertTrue(
      people.exists(p =>
        p.name == "John" &&
          p.id == janeId &&
          p.birthDate.contains(johnsBirthDay) &&
          p.deathDate.contains(johnsDeathDay)
      )
    )
  }

  private val canUpdateExistingFamily = testM("when updating a family members are not removed") {
    for {
      s <- newStemmaService

      Family(familyId, _ :: johnId :: Nil, jillId :: Nil) <- s.newFamily(family(createJane, createJohn)(createJill))
      _                                                   <- s.updateFamily(familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

      st @ Stemma(people, _) <- s.stemma()
      render(families)       = st
    } yield assertTrue(families == List("(John, July) parentsOf (James, Jill)")) &&
      assert(people.map(_.name))(hasSameElements("Jane" :: "John" :: "Jill" :: "July" :: "James" :: Nil))
  }

  override def spec =
    suite("StemmaRepository: basic operations")(
      canCreateFamily,
      canRemovePerson,
      leavingSingleMemberOfFamilyDropsTheFamily,
      canUpdateExistingPerson,
      canUpdateExistingFamily
    ) + suite("StemmaRepository: validation")(
      cantCreateFamilyOfSingleParent,
      cantCreateFamilyOfSingleChild,
      duplicatedIdsForbidden
    )
}
