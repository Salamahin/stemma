package io.github.salamahin.stemma

import cats.effect.Blocker
import io.circe.{Decoder, Encoder}
import io.github.salamahin.stemma.request.{PersonDescription}
import io.github.salamahin.stemma.service.graph.Graph
import io.github.salamahin.stemma.service.repository.Repository
import io.github.salamahin.stemma.service.storage.Storage
import org.http4s.circe.{jsonEncoderOf, jsonOf}
import org.http4s.dsl.Http4sDsl
import org.http4s.server.staticcontent.webjarServiceBuilder
import org.http4s.{EntityDecoder, EntityEncoder, HttpRoutes, StaticFile}
import zio.clock.Clock
import zio.{RIO, URIO, ZEnv, ZIO}

import scala.concurrent.ExecutionContext

object Main extends zio.App {
  import io.circe.generic.auto._
  import zio.interop.catz._

  type StemmaTask[A] = RIO[Repository with Storage with Graph with Clock, A]

  val repo = ZIO.accessM[Repository]
  val dsl  = Http4sDsl[StemmaTask]

  import dsl._

  implicit def circeJsonDecoder[A](implicit decoder: Decoder[A]): EntityDecoder[StemmaTask, A] = jsonOf[StemmaTask, A]
  implicit def circeJsonEncoder[A](implicit decoder: Encoder[A]): EntityEncoder[StemmaTask, A] = jsonEncoderOf[StemmaTask, A]
//
//  private val api = HttpRoutes.of[StemmaTask] {
//    case GET -> Root / "stemma"             => Ok(repo(_.get.stemma()))
//    case req @ POST -> Root / "person"      => req.as[PersonDescription].flatMap(person => Ok(repo(_.get newPerson person)))
//    case req @ POST -> Root / "person" / id => req.as[PersonDescription].flatMap(person => Ok(repo(_.get.updatePerson(id, person))))
//    case DELETE -> Root / "person" / id     => Ok(repo(_.get.removePerson(id)))
//    case req @ POST -> Root / "family"      => req.as[FamilyRequest].flatMap(family => Ok(repo(_.get newFamily family)))
//  }

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
    ???
//    ZIO
//      .runtime[ZEnv with Repository with Storage with Graph]
//      .flatMap { implicit runtime =>
//        val executor = runtime.platform.executor.asEC
//
//        BlazeServerBuilder[StemmaTask](executor)
//          .bindHttp(8080, "localhost")
//          .withHttpApp(
//            Router(
//              "/"    -> (static(executor) <+> webJars(executor)),
//              "/api" -> api
//            ).orNotFound
//          )
//          .resource
//          .toManagedZIO
//          .useForever
//      }
//      .provideCustomLayer(
//        graph.singleton >+>
//          storage.localGraphsonFile("stemma.graphson") >+>
//          repository.live
//      )
//      .foldCauseM(
//        err => putStrLn(err.prettyPrint).as(zio.ExitCode.failure),
//        _ => ZIO.succeed(zio.ExitCode.success)
//      )
  }
}
