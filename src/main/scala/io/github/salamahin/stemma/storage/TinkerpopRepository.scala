package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.service.domain.{Child, Family, Spouse, Stemma, Person => ServicePerson}
import io.github.salamahin.stemma.storage.domain.{Person => PersonVertex}
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import org.apache.commons.configuration.BaseConfiguration

import java.time.LocalDate
import java.time.format.DateTimeFormatter

final case class NoSuchParentId(id: String)  extends RuntimeException(s"No parent with id $id found")
final case class NoSuchChildId(id: String)   extends RuntimeException(s"No child with id $id found")
final case class NoSuchPartnerId(id: String) extends RuntimeException(s"No person with id $id found")

class TinkerpopRepository(file: String) {
  import gremlin.scala._
  import io.scalaland.chimney.dsl._

  import scala.jdk.CollectionConverters._

  private implicit val graph = {
    val config = new BaseConfiguration
    config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_EDGE_ID_MANAGER, "io.github.salamahin.stemma.StemmaEdgeIdManager")
    config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_VERTEX_ID_MANAGER, "io.github.salamahin.stemma.StemmaVertexIdManager")
    TinkerGraph.open(config).asScala()
  }

  private val name       = Key[String]("name")
  private val birthDate  = Key[String]("birthDate")
  private val deathDate  = Key[String]("deathDate")
  private val dateFormat = DateTimeFormatter.ISO_DATE

  def init(): Unit = {
//    new GraphTraversalSource(graph.asJava())
//      .io(file)
//      .`with`(IO.reader, IO.graphson)
//      .read()
//      .iterate()
  }

  def newPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) = {
    val birthDateProps = birthDate.map(this.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps = deathDate.map(this.deathDate -> dateFormat.format(_)).toSeq
    val nameProps      = this.name -> name :: Nil

    val newParent = graph + (name, nameProps ++ birthDateProps ++ deathDateProps: _*)
    newParent.id().asInstanceOf[String]
  }

  def addChild(parentId: String, childId: String) = {
    val parent   = graph.V(parentId).headOption().getOrElse(throw NoSuchParentId(parentId))
    val child    = graph.V(childId).headOption().getOrElse(throw NoSuchChildId(childId))
    val newChild = parent <-- "childOf" --- child
    newChild.id().asInstanceOf[String]
  }

  def addSpouse(partner1Id: String, partner2Id: String) = {
    val partner1 = graph.V(partner1Id).headOption().getOrElse(throw NoSuchPartnerId(partner1Id))
    val partner2 = graph.V(partner2Id).headOption().getOrElse(throw NoSuchPartnerId(partner2Id))

    partner1 <-- "spouseOf" --> partner2
  }

  def stemma() = {
    val (people, children, familiesWithChildren, spouseRelationWithChildren) = (for {
      person  <- graph.V
      parents <- person.out("childOf").fold()
    } yield (person, parents))
      .toMap
      .map {
        case (x, y) => x -> y.asScala.toList
      }
      .foldLeft((List.empty[ServicePerson], List.empty[Child], Set.empty[Family], Set.empty[Spouse])) {
        case ((people, children, families, spouses), (person, parents)) =>
          val servicePerson     = storedToService(person.toCC[PersonVertex])
          val serviceParentsIds = parents.map(_.id()).map(_.toString)

          if (serviceParentsIds.nonEmpty) {
            val familyId       = syntheticId(serviceParentsIds: _*)
            val family         = Family(familyId)
            val childRelation  = Child(syntheticId(familyId, servicePerson.id), familyId, servicePerson.id)
            val spouseRelation = serviceParentsIds.map(parentId => Spouse(syntheticId(parentId, familyId), parentId, familyId))

            (servicePerson :: people, childRelation :: children, families + family, spouses ++ spouseRelation)
          } else {
            (servicePerson :: people, children, families, spouses)
          }
      }

    val (familiesWithoutChildren, spouceRelationWithoutChildren) = (for {
      partner  <- graph.V
      partners <- partner.out("spouseOf").fold()
    } yield (partner, partners))
      .toMap
      .map {
        case (x, y) => x -> y.asScala.toList
      }
      .foldLeft((Set.empty[Family], Set.empty[Spouse])) {
        case ((families, spouces), (person, partners)) =>
          val personId    = person.id().toString
          val partnersIds = partners.map(_.id()).map(_.toString)

          val (newFamilies, newSpouces) = partnersIds.map { partnerId =>
            val familyId = syntheticId(personId, partnerId)

            (Family(familyId), Spouse(syntheticId(partnerId, familyId), partnerId, familyId))
          }.unzip

          (families ++ newFamilies, spouces ++ newSpouces)
      }

    Stemma(
      people,
      (familiesWithChildren ++ familiesWithoutChildren).toList,
      (spouceRelationWithoutChildren ++ spouseRelationWithChildren).toList,
      children
    )
  }

  private def syntheticId(values: String*) = values.mkString("+")

  private def storedToService(stored: PersonVertex) =
    stored
      .into[ServicePerson]
      .withFieldComputed(_.id, _.id.get)
      .transform

  def close(): Unit = {
    new GraphTraversalSource(graph.asJava())
      .io(file)
      .`with`(IO.writer, IO.graphson)
      .write()
      .iterate()
  }
}

object TinkerpopRepository extends App {
  val a = new TinkerpopRepository("stemma.graphson")
  a.init()
  val p0 = a.newPerson("parent0", None, None)
  val p1 = a.newPerson("parent1", None, None)
  val p2 = a.newPerson("parent2", None, None)
  val c1 = a.newPerson("child1", None, None)
  val c2 = a.newPerson("child2", None, None)
  val r1 = a.addChild(p1, c1)
  val r2 = a.addChild(p2, c1)
  val r3 = a.addChild(p2, c2)
  val r4 = a.addChild(p0, p1)
  val r5 = a.addSpouse(p1, p2)

  println(s"$c1 is a child of $p1 and $p2")
  println(s"$c2 is a child of $p2")
  println(s"$p1 is a child of $p0")

  println(a.stemma())
}
