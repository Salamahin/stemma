package io.github.salamahin.stemma

import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph

import java.time.LocalDate
import java.time.format.DateTimeFormatter

final case class NoSuchParentId(id: Int)  extends RuntimeException(s"No parent with id $id found")
final case class NoSuchChildId(id: Int)   extends RuntimeException(s"No child with id $id found")
final case class NoSuchPartnerId(id: Int) extends RuntimeException(s"No person with id $id found")

class TinkerpopRepository(file: String) {
  import gremlin.scala._
  private implicit val graph = TinkerGraph.open().asScala()

  private val name       = Key[String]("name")
  private val birthDate  = Key[String]("birthDate")
  private val deathDate  = Key[String]("deathDate")
  private val dateFormat = DateTimeFormatter.ISO_DATE

  def init(): Unit = {
    new GraphTraversalSource(graph.asJava())
      .io(file)
      .`with`(IO.reader, IO.graphson)
      .read()
      .iterate()
  }

  def newPerson(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Unit = {
    val birthDateProps = birthDate.map(this.birthDate -> dateFormat.format(_)).toSeq
    val deathDateProps = deathDate.map(this.deathDate -> dateFormat.format(_)).toSeq
    val nameProps      = this.name -> name :: Nil

    graph + (name, nameProps ++ birthDateProps ++ deathDateProps: _*)
  }

  def addChild(parentId: Int, childId: Int): Unit = {
    val parent = graph.V(parentId).headOption().getOrElse(throw NoSuchParentId(parentId))
    val child  = graph.V(childId).headOption().getOrElse(throw NoSuchChildId(childId))
    parent --- "parentOf" --> child
  }

  def addSpouse(partner1Id: Int, partner2Id: Int): Unit = {
    val partner1 = graph.V(partner1Id).headOption().getOrElse(throw NoSuchPartnerId(partner1Id))
    val partner2 = graph.V(partner2Id).headOption().getOrElse(throw NoSuchPartnerId(partner2Id))

    partner1 <-- "spouseOf" --> partner2
  }

  def stemma() = {
    val people = graph
      .V()
      .map { v =>
        val id = v.id().asInstanceOf[Int]

        id -> Person(
          id,
          v.label(),
          v.valueOption(birthDate).map(LocalDate.parse(_, dateFormat)),
          v.valueOption(deathDate).map(LocalDate.parse(_, dateFormat))
        )
      }
      .toMap

    val parentIdToChild = graph
      .V()
      .outE("parentOf")
      .map { e => e.outVertex().id().asInstanceOf[Int] -> e.inVertex().id().asInstanceOf[Int] }

    val spouseId = graph
      .E("spouseOf")
      .map { e => e.outVertex().id().asInstanceOf[Int] -> e.inVertex().id().asInstanceOf[Int] }
      .toMap


  }

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
  a.newPerson("aaa", None, None)
  a.newPerson("bbb", Some(LocalDate.now()), None)
  a.close()
}
