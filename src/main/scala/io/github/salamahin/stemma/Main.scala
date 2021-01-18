package io.github.salamahin.stemma

import cats.data.Validated
import io.circe.generic.auto._
import io.circe.{Decoder, Encoder}
import io.github.salamahin.stemma.repository.{Repository, Stemma}
import org.http4s._
import org.http4s.circe.{jsonEncoderOf, jsonOf}
import org.http4s.dsl.Http4sDsl
import org.http4s.implicits._
import org.http4s.server.blaze.BlazeServerBuilder
import zio._
import zio.clock.Clock
import zio.console.putStrLn
import zio.interop.catz._

import java.time.LocalDate
import java.time.format.DateTimeFormatter

object Main extends App {
  type StemmaTask[A] = RIO[Repository with Clock, A]

  val localDatePattern = DateTimeFormatter.ISO_DATE
  val repo             = ZIO.accessM[Repository]
  val dsl              = Http4sDsl[StemmaTask]
  import dsl._

  implicit def circeJsonDecoder[A](implicit decoder: Decoder[A]): EntityDecoder[StemmaTask, A] = jsonOf[StemmaTask, A]
  implicit def circeJsonEncoder[A](implicit decoder: Encoder[A]): EntityEncoder[StemmaTask, A] = jsonEncoderOf[StemmaTask, A]

  implicit val localDateDecoder = QueryParamCodec.localDateQueryParamCodec(localDatePattern)
  object kinsmanName    extends QueryParamDecoderMatcher[String]("name")
  object optKinsmanName extends OptionalQueryParamDecoderMatcher[String]("name")
  object optBirthDate   extends OptionalQueryParamDecoderMatcher[LocalDate]("birthDate")
  object optDeathDate   extends OptionalQueryParamDecoderMatcher[LocalDate]("deathDate")
  object parent1Id      extends QueryParamDecoderMatcher[Int]("parent1Id")
  object optParent1Id   extends OptionalQueryParamDecoderMatcher[Int]("parent1Id")
  object optParent2Id   extends OptionalQueryParamDecoderMatcher[Int]("parent2Id")
  object childrenIds    extends OptionalMultiQueryParamDecoderMatcher[Int]("childrenId")

  private val httpApp =
    HttpRoutes
      .of[StemmaTask] {
        case GET -> Root / "kinsman"                                                                              => Ok(repo(_.get.kinsmen))
        case POST -> Root / "kinsman" :? kinsmanName(name) +& optBirthDate(bd) +& optDeathDate(dd)                => Ok(repo(_.get.newKinsman(name, bd, dd)))
        case PUT -> Root / "kinsman" / IntVar(id) :? optKinsmanName(name) +& optBirthDate(bd) +& optDeathDate(dd) => Ok(repo(_.get.updateKinsman(id, name, bd, dd)))

        case GET -> Root / "family"                                                                                           => Ok(repo(_.get.families))
        case POST -> Root / "family" :? parent1Id(parent1) +& optParent2Id(parent2) +& childrenIds(Validated.Valid(children)) => Ok(repo(_.get.newFamily(parent1, parent2, children)))
        case PUT -> Root / "family" / IntVar(id) :? optParent1Id(parent1) +& optParent2Id(parent2) +& childrenIds(Validated.Valid(children)) =>
          Ok(repo(_.get.updateFamily(id, parent1, parent2, children)))
      }
      .orNotFound

  override def run(args: List[String]): zio.URIO[zio.ZEnv, zio.ExitCode] = {
    ZIO
      .runtime[ZEnv with Repository]
      .flatMap { implicit runtime =>
        BlazeServerBuilder[StemmaTask](runtime.platform.executor.asEC)
          .bindHttp(8080, "localhost")
          .withHttpApp(httpApp)
          .resource
          .toManagedZIO
          .useForever
          .foldCauseM(
            err => putStrLn(err.prettyPrint).as(zio.ExitCode.failure),
            _ => ZIO.succeed(zio.ExitCode.success)
          )
      }
      .provideCustomLayer(repository.live(Stemma(0, 0, Map.empty, Map.empty)))

  }
}
