package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.stemma.STEMMA
import zio.ZIO
import zio.test.Assertion._
import zio.test.{DefaultRunnableSpec, assert, assertTrue}

object BasicStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val service =
    ZIO
      .environment[STEMMA]
      .map(_.get)
      .provideCustomLayer(TempGraphService.make >>> repo.repo >>> stemma.basic)

  private val canCreateFamily = testM("can create different family with both parents and several children") {
    for {
      s <- service

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
      s   <- service
      err <- s.newFamily(family(createJohn)()).flip
    } yield assertTrue(err == CompositeError(IncompleteFamily() :: Nil))
  }

  private val cantCreateFamilyOfSingleChild = testM("there cant be a family with no parents and a single child") {
    for {
      s   <- service
      err <- s.newFamily(family()(createJill)).flip
    } yield assertTrue(err == CompositeError(IncompleteFamily() :: Nil))
  }

  private val duplicatedIdsForbidden = testM("cant update a family when there are duplicated ids in members") {
    for {
      s                                               <- service
      Family(familyId, jamesId :: Nil, jillId :: Nil) <- s.newFamily(family(createJames)(createJill))
      err                                             <- s.updateFamily(familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == CompositeError(DuplicatedIds(jamesId :: Nil) :: Nil))
  }

  private val canRemovePerson = testM("when removing a person hist child & spouse relations are removed as well") {
    for {
      s <- service

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
      s <- service

      Family(_, _, jillId :: Nil) <- s.newFamily(family(createJane)(createJill))
      Family(_, joshId :: Nil, _) <- s.newFamily(family(createJosh)(createJames))

      _ <- s.removePerson(jillId)
      _ <- s.removePerson(joshId)

      Stemma(people, families) <- s.stemma()
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "James" :: Nil))
  }

  private val canUpdateExistingPerson = testM("can update existing person") {
    for {
      s <- service

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
      s <- service

      Family(familyId, _ :: johnId :: Nil, jillId :: Nil) <- s.newFamily(family(createJane, createJohn)(createJill))
      _                                                   <- s.updateFamily(familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

      st @ Stemma(people, _) <- s.stemma()
      render(families)       = st
    } yield assertTrue(families == List("(John, July) parentsOf (James, Jill)")) &&
      assert(people.map(_.name))(hasSameElements("Jane" :: "John" :: "Jill" :: "July" :: "James" :: Nil))
  }

  override def spec =
    suite("StemmaService: basic operations")(
      canCreateFamily,
      canRemovePerson,
      leavingSingleMemberOfFamilyDropsTheFamily,
      canUpdateExistingPerson,
      canUpdateExistingFamily
    ) + suite("StemmaService: validation")(
      cantCreateFamilyOfSingleParent,
      cantCreateFamilyOfSingleChild,
      duplicatedIdsForbidden
    )
}
