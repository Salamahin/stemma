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
    override def load(): UIO[ScalaGraph] = UIO(TinkerGraph.open(new GraphConfig).asScala())
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

  private val leavingSingleMemberOfFamilyDropsTheFamily = testM("when the only member of family left the family is removed") {
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
