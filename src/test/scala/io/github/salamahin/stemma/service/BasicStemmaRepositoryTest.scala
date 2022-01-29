package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.AuthService.AUTH
import io.github.salamahin.stemma.service.GraphService.GRAPH
import io.github.salamahin.stemma.service.OpsService.OPS
import io.github.salamahin.stemma.service.SecretService.{SECRET, Secret}
import io.github.salamahin.stemma.service.StemmaService.STEMMA
import zio.test.Assertion.hasSameElements
import zio.test.{DefaultRunnableSpec, _}
import zio.{ULayer, ZIO, ZLayer}

object BasicStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {

  private val layer: ULayer[GRAPH with OPS with SECRET] = tempGraph ++ OpsService.live ++ hardcodedSecret
  private val services = (ZIO.environment[STEMMA].map(_.get) zip ZIO.environment[AUTH].map(_.get))
    .provideCustomLayer(layer >>> (StemmaService.live ++ AuthService.live))

  private val canCreateFamily = testM("can create different family with both parents and several children") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      _ <- s.createFamily(graphId, userId, family(createJane, createJohn)(createJill, createJosh))
      _ <- s.createFamily(graphId, userId, family(createJohn)(createJosh))
      _ <- s.createFamily(graphId, userId, family(createJane, createJohn)())
      _ <- s.createFamily(graphId, userId, family()(createJane, createJohn))

      render(families) <- s.stemma(graphId)
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
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      err <- s.createFamily(graphId, userId, family(createJohn)()).flip
    } yield assertTrue(err == IncompleteFamily())
  }

  private val cantCreateFamilyOfSingleChild = testM("there cant be a family with no parents and a single child") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      err <- s.createFamily(graphId, userId, family()(createJill)).flip
    } yield assertTrue(err == IncompleteFamily())
  }

  private val duplicatedIdsForbidden = testM("cant update a family when there are duplicated ids in members") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(familyId, jamesId :: Nil, jillId :: Nil) <- s.createFamily(graphId, userId, family(createJames)(createJill))
      err                                             <- s.updateFamily(graphId, userId, familyId, family(existing(jamesId), existing(jamesId))(existing(jillId))).flip
    } yield assertTrue(err == DuplicatedIds(jamesId :: Nil))
  }

  private val aChildCanBelongToASingleFamilyOnly = testM("a child must belong to a single family") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(firstFamilyId, _, jillId :: Nil) <- s.createFamily(graphId, userId, family(createJames)(createJill))
      err                                     <- s.createFamily(graphId, userId, family(createJane)(existing(jillId))).flip
    } yield assertTrue(err == ChildAlreadyBelongsToFamily(firstFamilyId, jillId))
  }

  private val canRemovePerson = testM("when removing a person hist child & spouse relations are removed as well") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, _, jillId :: _ :: Nil) <- s.createFamily(graphId, userId, family(createJane, createJohn)(createJill, createJames))
      _                                <- s.createFamily(graphId, userId, family(existing(jillId), createJosh)(createJake))
      _                                <- s.removePerson(jillId)

      render(families) <- s.stemma(graphId)
    } yield assert(families)(hasSameElements("(Jane, John) parentsOf (James)" :: "(Josh) parentsOf (Jake)" :: Nil))
  }

  private val aPersonCanBeSpouseInDifferentFamilies = testM("one can have several families as a spouse") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, jamesId :: Nil, _) <- s.createFamily(graphId, userId, family(createJames)(createJill))
      _                            <- s.createFamily(graphId, userId, family(existing(jamesId))(createJuly))

      render(families) <- s.stemma(graphId)
    } yield assert(families)(hasSameElements("(James) parentsOf (Jill)" :: "(James) parentsOf (July)" :: Nil))
  }

  private val leavingSingleMemberOfFamilyDropsEmptyFamilies = testM("when the only member of family left the family is removed") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, _, jillId :: Nil) <- s.createFamily(graphId, userId, family(createJane)(createJill))
      _                           <- s.createFamily(graphId, userId, family(existing(jillId))(createJuly))
      _                           <- s.createFamily(graphId, userId, family(existing(jillId))(createJames))

      _ <- s.removePerson(jillId)

      Stemma(people, families) <- s.stemma(graphId)
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "July" :: "James" :: Nil))
  }

  private val canUpdateExistingPerson = testM("can update existing person") {
    for {
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(_, janeId :: Nil, _) <- s.createFamily(graphId, userId, family(createJane)(createJill))

      _ <- s.updatePerson(janeId, createJohn)

      st @ Stemma(people, _) <- s.stemma(graphId)
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
      (s, a) <- services

      User(userId, _) <- a.getOrCreateUser("user@test.com")
      graphId         <- s.createGraph(userId, "test graph")

      Family(familyId, _ :: johnId :: Nil, jillId :: Nil) <- s.createFamily(graphId, userId, family(createJane, createJohn)(createJill))
      _                                                   <- s.updateFamily(graphId, userId, familyId, family(createJuly, existing(johnId))(existing(jillId), createJames))

      st @ Stemma(people, _) <- s.stemma(graphId)
      render(families)       = st
    } yield assertTrue(families == List("(John, July) parentsOf (James, Jill)")) &&
      assert(people.map(_.name))(hasSameElements("Jane" :: "John" :: "Jill" :: "July" :: "James" :: Nil))
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
      aChildCanBelongToASingleFamilyOnly
    )
}
