package io.github.salamahin.stemma

import io.github.salamahin.stemma.domain.{Family, FamilyDescription, PersonDescription, Stemma, StemmaError}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.service.{graph, stemma, storage}
import org.http4s.blaze.server.BlazeServerBuilder
import org.http4s.server.Router
import org.http4s.server.middleware.Logger
import sttp.tapir.server.http4s.ztapir.ZHttp4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter
import zio.blocking.Blocking
import zio.clock.Clock
import zio.console.{Console, putStrLn}
import zio.{ExitCode, RIO, URIO, ZIO}

object Main extends zio.App  {
  import sttp.tapir.generic.auto._
  import sttp.tapir.json.circe._
  import sttp.tapir.ztapir._
  import zio.interop.catz._

  type STEMMA_ENV     = STEMMA with Console with Clock with Blocking
  type STEMMA_TASK[A] = RIO[STEMMA_ENV, A]

  private val repo = ZIO.environment[STEMMA].map(_.get)

  private val getStemmaEndpoint = endpoint
    .get
    .in("stemma")
    .out(customJsonBody[Stemma])
    .zServerLogic(_ => repo.flatMap(_.stemma()))
    .widen[STEMMA_ENV]

  private val newFamilyEndpoint = endpoint
    .post
    .in("family")
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(familyDescr => repo.flatMap(_.newFamily(familyDescr)))
    .widen[STEMMA_ENV]

  private val updateFamilyEndpoint = endpoint
    .put
    .in("family")
    .in(path[Long].name("familyId"))
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic { case (id, family) => repo.flatMap(_.updateFamily(id, family)) }
    .widen[STEMMA_ENV]

  private val deleteFamilyEndpoint = endpoint
    .delete
    .in("family")
    .in(path[Long].name("familyId"))
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(id => repo.flatMap(_.removeFamily(id)))
    .widen[STEMMA_ENV]

  private val updatePersonEndpoint = endpoint
    .put
    .in("person")
    .in(path[Long].name("personId"))
    .in(customJsonBody[PersonDescription])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic { case (id, person) => repo.flatMap(_.updatePerson(id, person)) }
    .widen[STEMMA_ENV]

  private val deletePersonEndpoint = endpoint
    .delete
    .in("person")
    .in(path[Long].name("personId"))
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(id => repo.flatMap(_.removePerson(id)))
    .widen[STEMMA_ENV]

  private val serviceEndpoints =
    getStemmaEndpoint ::
      newFamilyEndpoint ::
      updateFamilyEndpoint ::
      deleteFamilyEndpoint ::
      updatePersonEndpoint ::
      deletePersonEndpoint ::
      Nil

  override def run(args: List[String]): URIO[zio.ZEnv, ExitCode] = {
    val deps = (graph.newGraph >>> (storage.localGraphsonFile("stemma.graphson") ++ stemma.basic)) >>> stemma.durable

    val serviceRoutes = Logger.httpRoutes[STEMMA_TASK](logHeaders = true, logBody = true, _ => false, Some(putStrLn(_)))(
      ZHttp4sServerInterpreter().from(serviceEndpoints).toRoutes
    )

    val swaggerRoutes = ZHttp4sServerInterpreter()
      .from(SwaggerInterpreter().fromServerEndpoints(serviceEndpoints, "Stemma Service", "1.0"))
      .toRoutes

    val httpApp = Logger.httpApp[STEMMA_TASK](logHeaders = true, logBody = true, _ => false, Some(putStrLn(_)))(
      Router(
        "/" -> serviceRoutes,
        "/" -> swaggerRoutes
      ).orNotFound
    )

    BlazeServerBuilder[STEMMA_TASK]
      .bindHttp(8080, "localhost")
      .withHttpApp(httpApp)
      .resource
      .toManagedZIO
      .useForever
      .provideCustomLayer(deps)
      .foldCauseM(
        err => putStrLn(err.prettyPrint).exitCode,
        _ => ZIO.succeed(zio.ExitCode.success)
      )
  }
}
