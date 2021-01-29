package io.github.salamahin.stemma

import cats.effect.Blocker
import io.circe.{Decoder, Encoder}
import io.github.salamahin.stemma.service.request.{NewChild, NewPerson, NewSpouse}
import io.github.salamahin.stemma.storage.repository
import io.github.salamahin.stemma.storage.repository.Repository
import org.http4s.circe.{jsonEncoderOf, jsonOf}
import org.http4s.dsl.Http4sDsl
import org.http4s.server.Router
import org.http4s.server.blaze.BlazeServerBuilder
import org.http4s.server.staticcontent.webjarServiceBuilder
import org.http4s.{EntityDecoder, EntityEncoder, HttpRoutes, StaticFile}
import zio.clock.Clock
import zio.console.putStrLn
import zio.{RIO, URIO, ZEnv, ZIO}

import java.nio.file.Paths
import java.time.format.DateTimeFormatter
import scala.concurrent.ExecutionContext

object Main extends zio.App {
  import cats.implicits._
  import io.circe.generic.auto._
  import org.http4s.implicits._
  import zio.interop.catz._

  type StemmaTask[A] = RIO[Repository with Clock, A]

  val localDatePattern = DateTimeFormatter.ISO_DATE
  val repo             = ZIO.accessM[Repository]
  val dsl              = Http4sDsl[StemmaTask]
  import dsl._

  implicit def circeJsonDecoder[A](implicit decoder: Decoder[A]): EntityDecoder[StemmaTask, A] = jsonOf[StemmaTask, A]
  implicit def circeJsonEncoder[A](implicit decoder: Encoder[A]): EntityEncoder[StemmaTask, A] = jsonEncoderOf[StemmaTask, A]

  private val api = HttpRoutes.of[StemmaTask] {
    case GET -> Root / "stemma"        => Ok(repo(_.get.stemma))
    case req @ POST -> Root / "person" => req.as[NewPerson].flatMap(person => Ok(repo(_.get newPerson person)))
    case req @ POST -> Root / "spouse" => req.as[NewSpouse].flatMap(family => Ok(repo(_.get newSpouse family)))
    case req @ POST -> Root / "child"  => req.as[NewChild].flatMap(child => Ok(repo(_.get newChild child)))
  }

  private def static(ec: ExecutionContext) = HttpRoutes.of[StemmaTask] {
    case request @ GET -> Root =>
      StaticFile
        .fromResource(s"/static/index.html", Blocker.liftExecutionContext(ec), Some(request))
        .getOrElseF(NotFound())

    case request @ GET -> Root / resource =>
      StaticFile
        .fromResource(s"/static/$resource", Blocker.liftExecutionContext(ec), Some(request))
        .getOrElseF(NotFound())
  }

  private def webJars(ec: ExecutionContext) = webjarServiceBuilder[StemmaTask](Blocker.liftExecutionContext(ec)).toRoutes

  override def run(args: List[String]): URIO[ZEnv, zio.ExitCode] = {
    ZIO
      .runtime[ZEnv with Repository]
      .flatMap { implicit runtime =>
        val executor = runtime.platform.executor.asEC

        BlazeServerBuilder[StemmaTask](executor)
          .bindHttp(8080, "localhost")
          .withHttpApp(
            Router(
              "/"    -> (static(executor) <+> webJars(executor)),
              "/api" -> api
            ).orNotFound
          )
          .resource
          .toManagedZIO
          .useForever
      }
      .provideCustomLayer(repository.tinkerpop("stemma.graphson.json"))
      .foldCauseM(
        err => putStrLn(err.prettyPrint).as(zio.ExitCode.failure),
        _ => ZIO.succeed(zio.ExitCode.success)
      )
  }
}
