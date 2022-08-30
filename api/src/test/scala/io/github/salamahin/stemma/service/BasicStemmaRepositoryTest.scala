package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import zio.test.Assertion.hasSameElements
import zio.test._
import zio.{Scope, ZIO}

object BasicStemmaRepositoryTest extends ZIOSpecDefault with Requests with RenderStemma {
  private val canCreateFamily = test("can create different family with both parents and several children") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
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
    }).provideSome(testcontainersStorage, Scope.default)
  }

  private val cantCreateFamilyOfSingleParent = test("there cant be a family with a single parent and no children") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      err <- s.createFamily(userId, stemmaId, family(createJohn)()).flip
    } yield assertTrue(err == IncompleteFamily())).provideSome(testcontainersStorage, Scope.default)
  }

  private val cantCreateFamilyOfSingleChild = test("there cant be a family with no parents and a single child") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      err <- s.createFamily(userId, stemmaId, family()(createJill)).flip
    } yield assertTrue(err == IncompleteFamily())).provideSome(testcontainersStorage, Scope.default)
  }

  private val appendChildrenToFullExistingFamily = test("when family description contains existing parents that already have a full family then children appended to that family") {
    (for {
      s               <- ZIO.service[StorageService]
      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _)       <- s.createFamily(userId, stemmaId, family(createJames)(createJane))
      FamilyDescription(_, _ :: jillId :: Nil, _, _) <- s.createFamily(userId, stemmaId, family(existing(jamesId), createJill)(createJohn))
      _                                              <- s.createFamily(userId, stemmaId, family(existing(jamesId), existing(jillId))(createJosh))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James, Jill) parentsOf (John, Josh)" :: "(James) parentsOf (Jane)" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val appendChildrenToIncompleteExistingFamily = test("when family description contains a single parent then newely added with same single parent appended to that family") {
    (for {
      s               <- ZIO.service[StorageService]
      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJane))
      _                                        <- s.createFamily(userId, stemmaId, family(existing(jamesId))(createJohn))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James) parentsOf (Jane, John)" :: Nil))).provideSome(testcontainersStorage, Scope.default)
  }

  private val duplicatedIdsForbidden = test("cant update a family when there are duplicated ids in members") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(familyId, jamesId :: Nil, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                           <- s.updateFamily(userId, familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == DuplicatedIds(jamesId))).provideSome(testcontainersStorage, Scope.default)
  }

  private val aChildCanBelongToASingleFamilyOnly = test("a child must belong to a single family") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(firstFamilyId, _, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJames)(createJill))
      err                                                   <- s.createFamily(userId, stemmaId, family(createJane)(existing(jillId))).flip
    } yield assertTrue(err == ChildAlreadyBelongsToFamily(firstFamilyId, jillId))).provideSome(testcontainersStorage, Scope.default)
  }

  private val canRemovePerson = test("when removing a person his child & spouse relations are removed as well") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: _ :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill, createJames))
      _                                              <- s.createFamily(userId, stemmaId, family(existing(jillId), createJosh)(createJake))
      _                                              <- s.removePerson(userId, jillId)

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(Jane, John) parentsOf (James)" :: "(Josh) parentsOf (Jake)" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val aPersonCanBeSpouseInDifferentFamilies = test("one can have several families as a spouse") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, jamesId :: _, _, _) <- s.createFamily(userId, stemmaId, family(createJames, createJane)(createJill))
      _                                        <- s.createFamily(userId, stemmaId, family(existing(jamesId))(createJuly))

      render(families) <- s.stemma(userId, stemmaId)
    } yield assert(families)(hasSameElements("(James, Jane) parentsOf (Jill)" :: "(James) parentsOf (July)" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val leavingSingleMemberOfFamilyDropsEmptyFamilies = test("when the only member of family left the family is removed") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(_, _, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane)(createJill))
      _                                         <- s.createFamily(userId, stemmaId, family(existing(jillId))(createJuly))

      _ <- s.removePerson(userId, jillId)

      Stemma(people, families) <- s.stemma(userId, stemmaId)
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "July" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val canUpdateExistingPerson = test("can update existing person") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
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
    )).provideSome(testcontainersStorage, Scope.default)
  }

  private val canUpdateExistingFamily = test("when updating a family members are not removed") {
    (for {
      s <- ZIO.service[StorageService]

      User(userId, _) <- s.getOrCreateUser("user@test.com")
      stemmaId        <- s.createStemma(userId, "test stemma")

      FamilyDescription(familyId, _ :: johnId :: Nil, jillId :: Nil, _) <- s.createFamily(userId, stemmaId, family(createJane, createJohn)(createJill))
      _                                                                 <- s.updateFamily(userId, familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

      st @ Stemma(people, _) <- s.stemma(userId, stemmaId)
      render(families)       = st
    } yield assertTrue(families == List("(John, July) parentsOf (James, Jill)")) &&
      assert(people.map(_.name))(hasSameElements("Jane" :: "John" :: "Jill" :: "July" :: "James" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val usersHaveSeparateGraphs = test("users might have separated stemmas") {
    (for {
      s               <- ZIO.service[StorageService]
      User(userId, _) <- s.getOrCreateUser("user1@test.com")

      userStemmaId1 <- s.createStemma(userId, "first stemma")
      _             <- s.createFamily(userId, userStemmaId1, family(createJane, createJohn)(createJosh, createJill))

      userStemmaId2 <- s.createStemma(userId, "second stemma")
      _             <- s.createFamily(userId, userStemmaId2, family(createJake)(createJuly, createJames))

      OwnedStemmasDescription(stemmas) <- s.listOwnedStemmas(userId)

      render(stemma1) <- s.stemma(userId, userStemmaId1)
      render(stemma2) <- s.stemma(userId, userStemmaId2)
    } yield assert(stemmas)(hasSameElements(StemmaDescription(userStemmaId1, "first stemma", true) :: StemmaDescription(userStemmaId2, "second stemma", true) :: Nil)) &&
      assert(stemma1)(hasSameElements("(Jane, John) parentsOf (Jill, Josh)" :: Nil)) &&
      assert(stemma2)(hasSameElements("(Jake) parentsOf (James, July)" :: Nil)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val cantUpdatePersonIfNotAnOwner = test("cant update or remove a person that dont own") {
    (for {
      s                   <- ZIO.service[StorageService]
      User(creatorId, _)  <- s.getOrCreateUser("user1@test.com")
      User(accessorId, _) <- s.getOrCreateUser("user2@test.com")

      stemmaId                                <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(_, janeId :: _, _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      personRemoveErr <- s.removePerson(accessorId, janeId).flip
      personUpdateErr <- s.updatePerson(accessorId, janeId, createJuly).flip
    } yield assertTrue(personRemoveErr == AccessToPersonDenied(janeId)) &&
      assertTrue(personUpdateErr == AccessToPersonDenied(janeId)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val cantUpdateFamilyIfNotAnOwner = test("cant update or remove a family that dont own") {
    (for {
      s                   <- ZIO.service[StorageService]
      User(creatorId, _)  <- s.getOrCreateUser("user1@test.com")
      User(accessorId, _) <- s.getOrCreateUser("user2@test.com")

      stemmaId                             <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(familyId, _, _, _) <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      familyRemoveErr <- s.removeFamily(accessorId, familyId).flip
      familyUpdateErr <- s.updateFamily(accessorId, familyId, family(createJames)(createJuly)).flip
    } yield assertTrue(familyRemoveErr == AccessToFamilyDenied(familyId)) &&
      assertTrue(familyUpdateErr == AccessToFamilyDenied(familyId)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private val whenUpdatingFamilyAllMembersShouldBelongToGraph = test("when updating a family with existing person there should be no members of different stemmas") {
    (for {
      s               <- ZIO.service[StorageService]
      User(userId, _) <- s.getOrCreateUser("user@test.com")

      stemma1Id <- s.createStemma(userId, "my first stemma")
      stemma2Id <- s.createStemma(userId, "my second stemma")

      FamilyDescription(_, janeId :: johnId :: Nil, joshId :: jillId :: Nil, _) <- s.createFamily(userId, stemma1Id, family(createJane, createJohn)(createJosh, createJill))
      familyCreationErr                                                         <- s.createFamily(userId, stemma2Id, family(existing(janeId), existing(johnId))(existing(joshId), existing(jillId))).flip
    } yield assertTrue(familyCreationErr == NoSuchPersonId(janeId))).provideSome(testcontainersStorage, Scope.default)
  }

  private val cantRequestStemmaIfNotGraphOwner = test("cant request stemma if not a stemma owner") {
    (for {
      s                   <- ZIO.service[StorageService]
      User(creatorId, _)  <- s.getOrCreateUser("user1@test.com")
      User(accessorId, _) <- s.getOrCreateUser("user2@test.com")

      stemmaId <- s.createStemma(creatorId, "my first stemma")
      _        <- s.createFamily(creatorId, stemmaId, family(createJane, createJohn)(createJosh, createJill))

      stemmaRequestErr <- s.stemma(accessorId, stemmaId).flip
    } yield assertTrue(stemmaRequestErr == AccessToStemmaDenied(stemmaId))).provideSome(testcontainersStorage, Scope.default)
  }

  private val canChangeOwnershipInRecursiveManner = test("ownership change affects spouses, their ancestors and children") {
    (for {
      s                   <- ZIO.service[StorageService]
      User(creatorId, _)  <- s.getOrCreateUser("user1@test.com")
      User(accessorId, _) <- s.getOrCreateUser("user2@test.com")

      /*
                f1                     f3
       jabe1 -> * <- jane2             * <-- jared7
               / \          f2        /
          jeff3   july4 --> * <-- josh5
                           /
                f4        /
       .........* <- jill6
               / \
           jess8   john9

       */

      stemmaId <- s.createStemma(creatorId, "my first stemma")

      FamilyDescription(_, _, _ :: july :: Nil, _)     <- s.createFamily(creatorId, stemmaId, family(createJabe, createJess)(createJeff, createJuly))
      FamilyDescription(f2, josh :: _, jill :: Nil, _) <- s.createFamily(creatorId, stemmaId, family(createJosh, existing(july))(createJill))
      FamilyDescription(f3, jared :: _, _, _)          <- s.createFamily(creatorId, stemmaId, family(createJared)(existing(josh)))
      FamilyDescription(f4, _, jess :: john :: Nil, _) <- s.createFamily(creatorId, stemmaId, family(existing(jill))(createJess, createJohn))

      ChownEffect(affectedFamilies, affectedPeople) <- s.chown(accessorId, stemmaId, josh)
      accessorStemma                                <- s.stemma(accessorId, stemmaId)

    } yield assertTrue(affectedFamilies.toSet == Set(f2, f3, f4)) &&
      assertTrue(affectedPeople.toSet == Set(jared, josh, july, jill, jess, john)) &&
      assert(accessorStemma)(canEditOnlyP(jared, josh, july, jill, jess, john)) &&
      assert(accessorStemma)(canEditOnlyF(f2, f3, f4)))
      .provideSome(testcontainersStorage, Scope.default)
  }

  private def canEditOnlyP(peopleIds: Long*) = Assertion.assertion[Stemma](s"Can edit only following people: ${peopleIds.mkString(",")}") { st =>
    st.people
      .filter(x => !x.readOnly)
      .map(_.id)
      .toSet == peopleIds.toSet
  }

  private def canEditOnlyF(familyIds: Long*) = Assertion.assertion[Stemma](s"Can edit only following families: ${familyIds.mkString(",")}") { st =>
    st.families
      .filter(x => !x.readOnly)
      .map(_.id)
      .toSet == familyIds.toSet
  }

  val whenThereAreSeveralOwnersThenStemmaIsNotRemovable = test("when there are several owners then chart is not removable") {
    (for {
      s                   <- ZIO.service[StorageService]
      User(creatorId, _)  <- s.getOrCreateUser("user1@test.com")
      User(accessorId, _) <- s.getOrCreateUser("user2@test.com")

      stemmaId                                  <- s.createStemma(creatorId, "my first stemma")
      FamilyDescription(_, _, jillId :: Nil, _) <- s.createFamily(creatorId, stemmaId, family(createJane)(createJill))

      _ <- s.chown(accessorId, stemmaId, jillId)

      creatorStemmas  <- s.listOwnedStemmas(creatorId)
      accessorStemmas <- s.listOwnedStemmas(accessorId)
    } yield assertTrue(
      creatorStemmas.stemmas.forall(s => !s.removable),
      accessorStemmas.stemmas.forall(s => !s.removable)
    )).provideSome(testcontainersStorage, Scope.default)
  }

  val canRemoveStemmaIfOnlyOwner = test("if only owner then can remove owned stemma") {
    (for {
      s                  <- ZIO.service[StorageService]
      User(creatorId, _) <- s.getOrCreateUser("user1@test.com")

      stemmaId <- s.createStemma(creatorId, "my first stemma")
      _        <- s.removeStemma(creatorId, stemmaId)

      stemmas <- s.listOwnedStemmas(creatorId)
    } yield assertTrue(stemmas.stemmas.isEmpty)).provideSome(testcontainersStorage, Scope.default)
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
      appendChildrenToIncompleteExistingFamily,
      whenThereAreSeveralOwnersThenStemmaIsNotRemovable,
      canRemoveStemmaIfOnlyOwner
    )
}
