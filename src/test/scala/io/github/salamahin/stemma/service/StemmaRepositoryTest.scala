package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.IncompleteFamily
import io.github.salamahin.stemma.gremlin.GraphConfig
import io.github.salamahin.stemma.request.{ExistingPersonId, FamilyDescription, PersonDefinition, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Person, Stemma}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.service.storage.GraphStorage
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.test.Assertion._
import zio.test.{DefaultRunnableSpec, assert, assertTrue}
import zio.{UIO, ZIO, ZLayer}

import java.time.LocalDate

object StemmaRepositoryTest extends DefaultRunnableSpec {
  import gremlin.scala._

  private val nopStorage = ZLayer.succeed(new GraphStorage {
    override def make(): UIO[ScalaGraph] = UIO(TinkerGraph.open(new GraphConfig).asScala())
    override def save(): UIO[Unit]       = UIO.succeed()
  })

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

  private val createJohn           = PersonDescription("John", Some(LocalDate.parse("1900-01-01")), Some(LocalDate.parse("2000-01-01")))
  private val createJane           = PersonDescription("Jane", Some(LocalDate.parse("1850-01-01")), Some(LocalDate.parse("1950-01-01")))
  private val createJames          = PersonDescription("James", None, None)
  private val createJake           = PersonDescription("Jake", None, None)
  private val createJuly           = PersonDescription("July", None, None)
  private val createJosh           = PersonDescription("Josh", None, None)
  private val createJill           = PersonDescription("Jill", None, None)
  private def existing(id: String) = ExistingPersonId(id)

  def family(parents: PersonDefinition*)(children: PersonDefinition*) = parents.toList match {
    case Nil             => FamilyDescription(None, None, children.toList)
    case p1 :: Nil       => FamilyDescription(Some(p1), None, children.toList)
    case p1 :: p2 :: Nil => FamilyDescription(Some(p1), Some(p2), children.toList)
    case _               => throw new IllegalArgumentException("too many parents")
  }

//  test("can create a family when without parents") {
//    repo.newFamily(FamilyDescription(None, None, johnDoe :: janeDoe :: Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 2
//    families.size shouldBe 1
//
//    families.head.parents shouldBe empty
//    families.head.children should contain only (ids(johnDoe.name), ids(janeDoe.name))
//  }
//
//  test("can create a family without children") {
//    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 2
//    families.size shouldBe 1
//
//    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
//    families.head.children shouldBe empty
//  }
//
//  test("creating a family with zero or one member yields errors") {
//    repo.newFamily(FamilyDescription(None, None, Nil)) shouldBe Left(IncompleteFamily())
//    repo.newFamily(FamilyDescription(Some(johnDoe), None, Nil)) shouldBe Left(IncompleteFamily())
//    repo.newFamily(FamilyDescription(None, None, janeDoe :: Nil)) shouldBe Left(IncompleteFamily())
//  }
//
//  test("can create a family with parents and children") {
//    repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil))
//
//    val Stemma(people, families) = repo.stemma()
//    val ids                      = nameToId(people)
//
//    people.size shouldBe 3
//    families.size shouldBe 1
//
//    families.head.parents should contain only (ids(johnDoe.name), ids(janeDoe.name))
//    families.head.children should contain only ids(joshDoe.name)
//  }
//
//  test("will raise an error if both parents are already married on each other") {
//    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)).getOrElse(throw new IllegalStateException())
//
//    val Stemma(people, _) = repo.stemma()
//    val ids               = nameToId(people)
//    val johnDoeId         = ExistingPersonId(ids(johnDoe.name))
//    val janeDoeId         = ExistingPersonId(ids(janeDoe.name))
//
//    inside(repo.newFamily(FamilyDescription(Some(johnDoeId), Some(janeDoeId), Nil))) {
//      case Left(CompositeError(SuchFamilyAlreadyExist(familyId, p1, p2) :: Nil)) =>
//        familyId shouldBe existentFamilyId
//        p1 shouldBe ids(johnDoe.name)
//        p2 shouldBe ids(janeDoe.name)
//    }
//  }
//
//  test("will raise an error if some of children are already belongs to a different families") {
//    val existentFamilyId = repo.newFamily(FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)).getOrElse(throw new IllegalStateException())
//
//    val Stemma(people, _) = repo.stemma()
//    val ids               = nameToId(people)
//    val joshDoeId         = ids(joshDoe.name)
//
//    inside(repo.newFamily(FamilyDescription(Some(jamesDoe), Some(jillDoe), ExistingPersonId(joshDoeId) :: Nil))) {
//      case Left(CompositeError(ChildBelongsToDifferentFamily(childId, familyId) :: Nil)) =>
//        childId shouldBe joshDoeId
//        familyId shouldBe existentFamilyId
//    }
//  }
//
//  test("existent family can be updated") {
//    val family1 = FamilyDescription(Some(johnDoe), Some(janeDoe), Nil)
//
//    val family1Id = repo.newFamily(family1).getOrElse(throw new IllegalStateException())
//    var ids       = nameToId(repo.stemma().people)
//    val janeDoeId = ids(janeDoe.name)
//
//    val family2 = FamilyDescription(Some(jillDoe), None, ExistingPersonId(janeDoeId) :: joshDoe :: Nil)
//    repo.updateFamily(family1Id, family2)
//    ids = nameToId(repo.stemma().people)
//
//    val Stemma(people, families) = repo.stemma()
//    people.map(_.name) should contain only (johnDoe.name, janeDoe.name, jillDoe.name, joshDoe.name)
//    families.size shouldBe 1
//    families.head.parents should contain only ids(jillDoe.name)
//    families.head.children should contain only (ids(janeDoe.name), ids(joshDoe.name))
//  }
//
//  test("can remove a family") {
//    val family   = FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)
//    val familyId = repo.newFamily(family).getOrElse(throw new IllegalStateException())
//
//    repo.removeFamilyIfExist(familyId)
//    val Stemma(people, families) = repo.stemma()
//
//    people.map(_.name) should contain only (johnDoe.name, janeDoe.name, joshDoe.name)
//    families shouldBe empty
//  }
//
//  test("family can be described") {
//    val family   = FamilyDescription(Some(johnDoe), Some(janeDoe), joshDoe :: Nil)
//    val familyId = repo.newFamily(family).getOrElse(throw new IllegalStateException())
//
//    val Stemma(_, families) = repo.stemma()
//
//    val FamilyDescription(Some(ExistingPersonId(p1)), Some(ExistingPersonId(p2)), ExistingPersonId(c1) :: Nil) =
//      repo.describeFamily(familyId).getOrElse(throw new IllegalStateException())
//
//    families.head.parents should contain only (p1, p2)
//    families.head.children should contain only c1
//  }

  private val service = ZIO.environment[STEMMA].map(_.get)

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
    } yield assertTrue(err == IncompleteFamily())
  }

  private val cantCreateFamilyOfSingleChild = testM("there cant be a family with no parents and a single child") {
    for {
      s   <- service
      err <- s.newFamily(family()(createJill)).flip
    } yield assertTrue(err == IncompleteFamily())
  }

  private val canRemoveChild = testM("when removing a person hist child & spouse relations are removed as well") {
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

  private val leavingSingleMemberOfFamilyDropsTheFamily = testM("wen the only member of family left the family is removed") {
    for {
      s <- service

      Family(_, _, jillId :: Nil) <- s.newFamily(family(createJane)(createJill))
      Family(_, joshId :: Nil, _) <- s.newFamily(family(createJosh)(createJames))
      _                           <- s.removePerson(jillId)
      _                           <- s.removePerson(joshId)

      Stemma(people, families) <- s.stemma()
    } yield assertTrue(families.isEmpty) && assert(people.map(_.name))(hasSameElements("Jane" :: "James" :: Nil))
  }

  override def spec =
    suite("StemmaRepository's positive scenarios")(
      canCreateFamily,
      cantCreateFamilyOfSingleParent,
      cantCreateFamilyOfSingleChild,
      canRemoveChild,
      leavingSingleMemberOfFamilyDropsTheFamily
    ).provideCustomLayer(nopStorage >>> stemma.basic)
}
