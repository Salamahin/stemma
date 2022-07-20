package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import zio.ZIO
import zio.test.Assertion.{hasNoneOf, hasSameElements}
import zio.test._

object BasicStemmaRepositoryTest extends ZIOSpecDefault with Requests with RenderStemma {
  private val services = (ZIO.service[StemmaService] zip ZIO.service[UserService])
    .provide(tempGraph, hardcodedSecret, StemmaService.live, UserService.live)

  private val canCreateFamily = test("can create different family with both parents and several children") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      _ <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill, createJosh))
      _ <- s.createFamily(userId, stemmaId, family(createJohn)(createJosh))
      _ <- s.createFamily(userId, stemmaId, family(createJane, createJohn)())
      _ <- s.createFamily(userId, stemmaId, family()(createJane, createJohn))

      render(families) <- s.stemma(userId, stemmaId)
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

  private val cantCreateFamilyOfSingleParent = test("there cant be a family with a single parent and no children") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      err <- s.createFamily(userId, stemmaId, family(createJohn)()).flip
    } yield assertTrue(err == IncompleteFamily())
  }

  private val cantCreateFamilyOfSingleChild = test("there cant be a family with no parents and a single child") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      err <- s.createFamily(userId, stemmaId, family()(createJill)).flip
    } yield assertTrue(err == IncompleteFamily())
  }

  private val appendChildrenToFullExistingFamily = test("when family description contains existing parents that already have a full family then children appended to that family") {
    for {
      (s, a)          <- services
      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _)       <- s.createFamily(userId, stemmaId, family(createJames)(createJane))
      FamilyDescription(_, _ :: jillId :: Nil, _, _) <- s.createFamily(userId, stemmaId, family(existing(jamesId), createJill)(createJohn))
      _                                              <- s.createFamily(userId, stemmaId, family(existing(jamesId), existing(jillId))(createJosh))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James, Jill) parentsOf (John, Josh)" :: "(James) parentsOf (Jane)" :: Nil))
  }

  private val appendChildrenToIncompleteExistingFamily = test("when family description contains a single parent then newely added with same single parent appended to that family") {
    for {
      (s, a)          <- services
      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJane))
      _                                        <- s.createFamily(userId, stemmaId, family(existing(jamesId))(createJohn))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James) parentsOf (Jane, John)" :: Nil))
  }

  private val duplicatedIdsForbidden = test("cant update a family when there are duplicated ids in members") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(familyId, jamesId :: Nil, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                           <- s.updateFamily(userId, familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == DuplicatedIds(jamesId :: Nil))
  }

  private val aChildCanBelongToASingleFamilyOnly = test("a child must belong to a single family") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(firstFamilyId, _, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                   <- s.createFamily(userId, stemmaId, family(createJane)(existing(jillId))).flip
    } yield assertTrue(err == ChildAlreadyBelongsToFamily(firstFamilyId, jillId))
  }

  private val canRemovePerson = test("when removing a person hist child & spouse relations are removed as well") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: _ :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill, createJames))
      _                                              <- s.createFamily(userId, stemmaId, family(existing(jillId), createJosh)(createJake))
      _                                              <- s.removePerson(userId, jillId)

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(Jane, John) parentsOf (James)" :: "(Josh) parentsOf (Jake)" :: Nil))
  }

  private val aPersonCanBeSpouseInDifferentFamilies = test("one can have several families as a spouse") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _) <- s.createFamily(userId, stemmaId, family(createJames, createJane)(createJill))
      _                                        <- s.createFamily(userId, stemmaId, family(existing(jamesId))(createJuly))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James, Jane) parentsOf (Jill)" :: "(James) parentsOf (July)" :: Nil))
  }

  private val leavingSingleMemberOfFamilyDropsEmptyFamilies = test("when the only member of family left the family is removed") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane)(createJill))
      _                                         <- s.createFamily(userId, stemmaId, family(existing(jillId))(createJuly))

      _ <- s.removePerson(userId, jillId)

      Stemma(people, families) <- s.stemma(userId, stemmaId)
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "July" :: Nil))
  }

  private val canUpdateExistingPerson = test("can update existing person") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, janeId :: Nil, _, _) <- s.createFamily(userId, stemmaId, family(createJane)(createJill))

      _ <- s.updatePerson(userId, janeId, createJohn)

      st @ Stemma(people, _) <- s.stemma(userId, stemmaId)
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

  private val canUpdateExistingFamily = test("when updating a family members are not removed") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(familyId, _ :: johnId :: Nil, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill))
      _                                                                 <- s.updateFamily(userId, familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

      st @ Stemma(people, _) <- s.stemma(userId, stemmaId)
      render(families)       = st
    } yield assertTrue(families == List("(John, July) parentsOf (James, Jill)")) &&
      assert(people.map(_.name))(hasSameElements("Jane" :: "John" :: "Jill" :: "July" :: "James" :: Nil))
  }

  private val usersHaveSeparateGraphs = test("users might have separated stemmas") {
    for {
      (s, a)          <- services
      User(userId, _) <- a.getOrCreateUser(Email("user1@test.com"))

      userStemmaId1 <- s.createStemma(userId, "first stemma")
      _             <- s.createFamily(userId, userStemmaId1, family(createJane, createJohn)(createJosh, createJill))

      userStemmaId2 <- s.createStemma(userId, "second stemma")
      _             <- s.createFamily(userId, userStemmaId2, family(createJake)(createJuly, createJames))

      OwnedStemmasDescription(stemmas) <- s.listOwnedStemmas(userId)

      render(stemma1) <- s.stemma(userId, userStemmaId1)
      render(stemma2) <- s.stemma(userId, userStemmaId2)
    } yield assert(stemmas)(hasSameElements(StemmaDescription(userStemmaId1, "first stemma") :: StemmaDescription(userStemmaId2, "second stemma") :: Nil)) &&
      assert(stemma1)(hasSameElements("(Jane, John) parentsOf (Jill, Josh)" :: Nil)) &&
      assert(stemma2)(hasSameElements("(Jake) parentsOf (James, July)" :: Nil))
  }

  private val cantUpdatePersonIfNotAnOwner = test("cant update or remove a person that dont own") {
    for {
      (s, a)              <- services
      User(creatorId, _)  <- a.getOrCreateUser(Email("user1@test.com"))
      User(accessorId, _) <- a.getOrCreateUser(Email("user2@test.com"))

      stemmaId                                <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(_, janeId :: _, _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      personRemoveErr <- s.removePerson(accessorId, janeId).flip
      personUpdateErr <- s.updatePerson(accessorId, janeId, createJuly).flip
    } yield assertTrue(personRemoveErr == AccessToPersonDenied(janeId)) &&
      assertTrue(personUpdateErr == AccessToPersonDenied(janeId))
  }

  private val cantUpdateFamilyIfNotAnOwner = test("cant update or remove a family that dont own") {
    for {
      (s, a)              <- services
      User(creatorId, _)  <- a.getOrCreateUser(Email("user1@test.com"))
      User(accessorId, _) <- a.getOrCreateUser(Email("user2@test.com"))

      stemmaId                             <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(familyId, _, _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      familyRemoveErr <- s.removeFamily(accessorId, familyId).flip
      familyUpdateErr <- s.updateFamily(accessorId, familyId, family(createJames)(createJuly)).flip
    } yield assertTrue(familyRemoveErr == AccessToFamilyDenied(familyId)) &&
      assertTrue(familyUpdateErr == AccessToFamilyDenied(familyId))
  }

  private val whenUpdatingFamilyAllMembersShouldBelongToGraph = test("when updating a family with existing person there should be no members of different stemmas") {
    for {
      (s, a)          <- services
      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))

      stemma1Id <- s.createStemma(userId, "my first stemma")
      stemma2Id <- s.createStemma(userId, "my second stemma")

      FamilyDescription(_, janeId :: johnId :: Nil, joshId :: jillId :: Nil, _) <- s.createFamily(userId, stemma1Id, family(createJane, createJohn)(createJosh, createJill))
      familyCreationErr                                                         <- s.createFamily(userId, stemma2Id, family(existing(janeId), existing(johnId))(existing(joshId), existing(jillId))).flip
    } yield assertTrue(familyCreationErr == NoSuchPersonId(janeId))
  }

  private val cantRequestStemmaIfNotGraphOwner = test("cant request stemma if not a stemma owner") {
    for {
      (s, a)              <- services
      User(creatorId, _)  <- a.getOrCreateUser(Email("user1@test.com"))
      User(accessorId, _) <- a.getOrCreateUser(Email("user2@test.com"))

      stemmaId <- s.createStemma(creatorId, "my first stemma")
      _        <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      stemmaRequestErr <- s.stemma(accessorId, stemmaId).flip
    } yield assertTrue(stemmaRequestErr == AccessToStemmaDenied(stemmaId))
  }

  private def readOnlyP(people: Seq[PersonDescription])   = people.map(p => (p.id, p.readOnly)).toMap
  private def readOnlyF(families: Seq[FamilyDescription]) = families.map(p => (p.id, p.readOnly)).toMap

  private val canChangeOwnershipInRecursiveManner = test("ownership change affects spouses, their ancestors and children") {
    for {
      (s, a)              <- services
      User(creatorId, _)  <- a.getOrCreateUser(Email("user1@test.com"))
      User(accessorId, _) <- a.getOrCreateUser(Email("user2@test.com"))

      /*
         july7             jane1 + john2
             \           /           \
              jake5 + jill4             josh3
                         \
                          james6
                               \
                                jeff8

       if jill ownership is granted, one can edit july, jake, jill, james & jeff. In other words the target person,
       her spouses and children, and ancestors of her spouses
       */

      stemmaId <- s.createStemma(creatorId, "my first stemma")

      FamilyDescription(janeJohnFamilyId, janeId :: johnId :: Nil, joshId :: jillId :: Nil, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))
      FamilyDescription(jakeJillFamilyId, _ :: jakeId :: Nil, jamesId :: Nil, _)               <- s.createFamily(creatorId, stemmaId, family(existing(jillId), createJake)(createJames))
      FamilyDescription(julyJakeFamilyId, julyId :: Nil, _, _)                                 <- s.createFamily(creatorId, stemmaId, family(createJuly)(existing(jakeId)))
      FamilyDescription(jamesJeffFamilyId, _, jeffId :: Nil, _)                                <- s.createFamily(creatorId, stemmaId, family(existing(jamesId))(createJeff))

      chownEffect <- s.chown(accessorId, jillId)

      creatorStemma  <- s.stemma(creatorId, stemmaId)
      accessorStemma <- s.stemma(accessorId, stemmaId)

      creatorReadOnlyP  = readOnlyP(creatorStemma.people)
      accessorReadOnlyP = readOnlyP(accessorStemma.people)

      creatorReadOnlyF  = readOnlyF(creatorStemma.families)
      accessorReadOnlyF = readOnlyF(accessorStemma.families)

    } yield assert(chownEffect.affectedPeople)(hasSameElements(jillId :: julyId :: jakeId :: jamesId :: jeffId :: Nil)) &&
      assert(chownEffect.affectedPeople)(hasNoneOf(janeId :: johnId :: joshId :: Nil)) &&
      assert(chownEffect.affectedFamilies)(hasSameElements(jakeJillFamilyId :: julyJakeFamilyId :: jamesJeffFamilyId :: Nil)) &&
      assert(chownEffect.affectedFamilies)(hasNoneOf(janeJohnFamilyId :: Nil)) &&
      //
      assertTrue(accessorReadOnlyF == Map(janeJohnFamilyId -> true, jakeJillFamilyId  -> false, julyJakeFamilyId -> false, jamesJeffFamilyId -> false)) &&
      assertTrue(creatorReadOnlyF == Map(janeJohnFamilyId  -> false, jakeJillFamilyId -> true, julyJakeFamilyId  -> true, jamesJeffFamilyId  -> true)) &&
      //
      assertTrue(accessorReadOnlyP == Map(janeId -> true, johnId  -> true, joshId  -> true, jakeId  -> false, jillId -> false, jamesId -> false, julyId -> false, jeffId -> false)) &&
      assertTrue(creatorReadOnlyP == Map(janeId  -> false, johnId -> false, joshId -> false, jakeId -> true, jillId  -> true, jamesId  -> true, julyId  -> true, jeffId  -> true))
  }

  override def spec =
    suite("StemmaService: basic ops & rules")(
      canCreateFamily,
      canRemovePerson,
      leavingSingleMemberOfFamilyDropsEmptyFamilies,
      canUpdateExistingPerson,
      canUpdateExistingFamily,
      aPersonCanBeSpouseInDifferentFamilies,
      cantCreateFamilyOfSingleParent,
      cantCreateFamilyOfSingleChild,
      duplicatedIdsForbidden,
      aChildCanBelongToASingleFamilyOnly,
      usersHaveSeparateGraphs,
      cantUpdatePersonIfNotAnOwner,
      cantUpdateFamilyIfNotAnOwner,
      cantRequestStemmaIfNotGraphOwner,
      whenUpdatingFamilyAllMembersShouldBelongToGraph,
      canChangeOwnershipInRecursiveManner,
      appendChildrenToFullExistingFamily,
      appendChildrenToIncompleteExistingFamily
    )
}
