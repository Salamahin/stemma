package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.tinkerpop.StemmaOperations
import zio.test.Assertion.hasSameElements
import zio.test.{DefaultRunnableSpec, _}
import zio.{ULayer, ZIO}

object BasicStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {

  private val layer: ULayer[GraphService with StemmaOperations with Secrets] = tempGraph ++ OpsService.live ++ hardcodedSecret
  private val services = (ZIO.environment[StemmaService].map(_.get) zip ZIO.environment[UserService].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ UserService.live))

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

  private val duplicatedIdsForbidden = test("cant update a family when there are duplicated ids in members") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(familyId, jamesId :: Nil, jillId :: Nil) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                        <- s.updateFamily(userId, familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == DuplicatedIds(jamesId :: Nil))
  }

  private val aChildCanBelongToASingleFamilyOnly = test("a child must belong to a single family") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(firstFamilyId, _, jillId :: Nil) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                <- s.createFamily(userId, stemmaId, family(createJane)(existing(jillId))).flip
    } yield assertTrue(err == ChildAlreadyBelongsToFamily(firstFamilyId, jillId))
  }

  private val canRemovePerson = test("when removing a person hist child & spouse relations are removed as well") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: _ :: Nil) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill, createJames))
      _                                           <- s.createFamily(userId, stemmaId, family(existing(jillId), createJosh)(createJake))
      _                                           <- s.removePerson(userId, jillId)

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(Jane, John) parentsOf (James)" :: "(Josh) parentsOf (Jake)" :: Nil))
  }

  private val aPersonCanBeSpouseInDifferentFamilies = test("one can have several families as a spouse") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      _                                       <- s.createFamily(userId, stemmaId, family(existing(jamesId))(createJuly))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James) parentsOf (Jill)" :: "(James) parentsOf (July)" :: Nil))
  }

  private val leavingSingleMemberOfFamilyDropsEmptyFamilies = test("when the only member of family left the family is removed") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: Nil) <- s.createFamily(userId, stemmaId, family(createJane)(createJill))
      _                                      <- s.createFamily(userId, stemmaId, family(existing(jillId))(createJuly))
      _                                      <- s.createFamily(userId, stemmaId, family(existing(jillId))(createJames))

      _ <- s.removePerson(userId, jillId)

      Stemma(people, families) <- s.stemma(userId, stemmaId)
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "July" :: "James" :: Nil))
  }

  private val canUpdateExistingPerson = test("can update existing person") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser(Email("user@test.com"))
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, janeId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane)(createJill))

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

      FamilyDescription(familyId, _ :: johnId :: Nil, jillId :: Nil) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill))
      _                                                              <- s.updateFamily(userId, familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

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

      stemmaId                             <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(_, janeId :: _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

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

      stemmaId                          <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(familyId, _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

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

      FamilyDescription(_, janeId :: johnId :: Nil, joshId :: jillId :: Nil) <- s.createFamily(userId, stemma1Id, family(createJane, createJohn)(createJosh, createJill))
      familyCreationErr                                                      <- s.createFamily(userId, stemma2Id, family(existing(janeId), existing(johnId))(existing(joshId), existing(jillId))).flip
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

  private val canChangeOwnershipInRecursiveManner = test("ownership change affects spouses, their ancestors and children") {
    for {
      (s, a)              <- services
      User(creatorId, _)  <- a.getOrCreateUser(Email("user1@test.com"))
      User(accessorId, _) <- a.getOrCreateUser(Email("user2@test.com"))

      /*
         july             jane + john
             \           /           \
              jake + jill             josh
                         \
                          james
                               \
                                jeff

       if jill ownership is granted, one can edit july, jake, jill, james & jeff. In other words the target person,
       her spouses and children, and ancestors of her spouses
       */

      stemmaId                                                                <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(_, _, _ :: jillId :: Nil)                             <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))
      FamilyDescription(jakeJillFamilyId, _ :: jakeId :: Nil, jamesId :: Nil) <- s.createFamily(creatorId, stemmaId, family(existing(jillId), createJake)(createJames))
      FamilyDescription(julyJakeFamilyId, julyId :: Nil, _)                   <- s.createFamily(creatorId, stemmaId, family(createJuly)(existing(jakeId)))
      FamilyDescription(jamesJeffFamilyId, _, jeffId :: Nil)                  <- s.createFamily(creatorId, stemmaId, family(existing(jamesId))(createJeff))

      chownEffect <- s.describeChown(creatorId, accessorId, jillId)
    } yield assert(chownEffect.affectedPeople)(hasSameElements(jillId :: julyId :: jakeId :: jamesId :: jeffId :: Nil)) &&
      assert(chownEffect.affectedFamilies)(hasSameElements(jakeJillFamilyId :: julyJakeFamilyId :: jamesJeffFamilyId :: Nil))
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
      canChangeOwnershipInRecursiveManner
    )
}
