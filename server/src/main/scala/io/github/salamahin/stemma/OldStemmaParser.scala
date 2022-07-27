package io.github.salamahin.stemma

import io.circe.generic.extras.Configuration
import io.circe.{Decoder, DecodingFailure}
import io.github.salamahin.stemma.domain.{CreateFamily, CreateNewPerson, ExistingPerson}
import io.github.salamahin.stemma.service.{GraphService, Secrets, StemmaService}
import zio.{ExitCode, Scope, ZIO, ZIOAppArgs, ZIOAppDefault}

import scala.io.Source
import scala.util.Using

case class Generation()

sealed trait Value
case class UuidValue(`@type`: String, `@value`: String)  extends Value
case class NumericValue(`@type`: String, `@value`: Long) extends Value

sealed trait Property
case class StringProperty(id: NumericValue, value: String)        extends Property
case class NumericProperty(id: NumericValue, value: NumericValue) extends Property

case class InEdge(id: UuidValue, outV: UuidValue)
case class OutEdge(id: UuidValue, inV: UuidValue)

case class Vertex(
  id: UuidValue,
  label: String,
  inE: Map[String, Seq[InEdge]],
  outE: Map[String, Seq[OutEdge]],
  name: Option[String]
)

object Vertex {
  val nameDec = Decoder.instance { cursor =>
    if (cursor.keys.toList.contains("properties")) {
      val name = cursor.downField("properties").downField("name").downN(0).downField("name").as[String]
      Right(Some(name))
    } else
      Right(None)
  }

  def vertexDec(implicit d1: Decoder[UuidValue], d2: Decoder[InEdge], d3: Decoder[OutEdge]) = Decoder.instance { cursor =>
    val keys                                                     = cursor.keys.toList.flatten
    val id                                                       = cursor.downField("id").as[UuidValue]
    val label                                                    = cursor.downField("label").as[String]
    val inE: Either[DecodingFailure, Map[String, Seq[InEdge]]]   = if (keys.contains("inE")) cursor.downField("inE").as[Map[String, Seq[InEdge]]] else Right(Map.empty)
    val outE: Either[DecodingFailure, Map[String, Seq[OutEdge]]] = if (keys.contains("outE")) cursor.downField("outE").as[Map[String, Seq[OutEdge]]] else Right(Map.empty)
    val name: Either[DecodingFailure, Option[String]] =
      if (keys.contains("properties"))
        cursor.downField("properties").downField("name").downN(0).downField("value").as[String].map(Option(_))
      else
        Right(None)

    for {
      id    <- id
      label <- label
      inE   <- inE
      outE  <- outE
      name  <- name
    } yield Vertex(id, label, inE, outE, name)
  }

}

object OldStemmaParser extends ZIOAppDefault {
  import cats.implicits._
  import io.circe.generic.auto._
  import io.circe.parser.decode

  implicit val config: Configuration = Configuration.default.withDefaults

  val data = Using(Source.fromFile("tree"))(_.getLines().map(line => decode[Vertex](line)(Vertex.vertexDec).leftMap(err => new IllegalStateException(line, err))).toList)
    .toEither
    .flatMap(decodes => decodes.traverse(identity))

  val verteces = data.fold(
    th => throw new RuntimeException(th),
    vs => vs
  )

  val (vPeople, vFamilies) = verteces.partition(_.label == "person")
  val oldIdToPersonName    = vPeople.map(v => v.id.`@value` -> v.name.get).toMap
//  oldIdToPersonName.foreach(println)

  case class F(parents: Seq[String], children: Seq[String])
  val families = vFamilies
    .map(v => F(v.inE.values.flatten.map(_.outV.`@value`).toSeq, v.outE.values.flatten.map(_.inV.`@value`).toSeq))
    .filter(f => (f.parents.size + f.children.size) > 1)

  families.foreach(println)

//  families.foreach { f =>
//    val fs = f.parents.map(oldIdToPersonName).mkString(", ")
//    val cs = f.children.map(oldIdToPersonName).mkString(", ")
//  }

  def populate(s: StemmaService, userId: String, stemmaId: String, f: F, oldToNewId: Map[String, String]) = {
    val parents = f
      .parents
      .map(pid =>
        oldToNewId
          .get(pid)
          .map(ExistingPerson)
          .getOrElse(CreateNewPerson(oldIdToPersonName(pid), None, None, None))
      )

    val children = f
      .children
      .map(cid =>
        oldToNewId
          .get(cid)
          .map(ExistingPerson)
          .getOrElse(CreateNewPerson(oldIdToPersonName(cid), None, None, None))
      )

    val p1 = parents.headOption
    val p2 = parents.lift(1)

    val request = CreateFamily(p1, p2, children.toList)

    for {
      resp <- s.createFamily(userId, stemmaId, request)
    } yield oldToNewId ++ (f.parents zip resp.parents) ++ (f.children zip resp.children)
  }

  override def run: ZIO[Any with ZIOAppArgs with Scope, Any, Any] = {
    (for {
      s        <- ZIO.service[StemmaService]
      stemmaId <- s.createStemma("public.user:::1", "Общий")
      _ <- ZIO.foldLeft(families)(Map.empty[String, String]) {
            case (oldToNew, f) => populate(s, "public.user:::1", stemmaId, f, oldToNew)
          }

      stemma <- s.stemma("public.user:::1", stemmaId)
      _      = println(stemma)
    } yield ())
      .provide(StemmaService.live, GraphService.postgres, Secrets.envSecrets, Scope.default)
      .foldCause(
        failure => { println(s"Unexpected failure:\n${failure.prettyPrint}"); ExitCode.failure },
        _ => { println("bb gl hf"); ExitCode.success; }
      )
  }
}
