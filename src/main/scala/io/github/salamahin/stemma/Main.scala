package io.github.salamahin.stemma

import io.github.salamahin.stemma.request.{FamilyDescription, PersonDescription}
import io.github.salamahin.stemma.response.{Family, Stemma}
import io.github.salamahin.stemma.service.stemma.STEMMA
import io.github.salamahin.stemma.service.{graph, stemma, storage}
import org.http4s.blaze.server.BlazeServerBuilder
import org.http4s.server.Router
import sttp.tapir.docs.openapi.OpenAPIDocsInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter
import zio.blocking.Blocking
import zio.clock.Clock
import zio.console.putStrLn
import zio.{ExitCode, RIO, URIO, ZIO}

object Main extends zio.App {
  import io.circe.generic.auto._
  import sttp.tapir.generic.auto._
  import sttp.tapir.json.circe._
  import sttp.tapir.server.http4s.ztapir.ZHttp4sServerInterpreter
  import sttp.tapir.ztapir._

  private val repo = ZIO.environment[STEMMA].map(_.get)

  private val getStemmaEndpoint = endpoint
    .get
    .in("stemma")
    .out(customJsonBody[Stemma])
    .zServerLogic(_ => repo.flatMap(_.stemma()))

  private val newFamilyEndpoint = endpoint
    .post
    .in("family")
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(familyDescr => repo.flatMap(_.newFamily(familyDescr)))

  private val updateFamilyEndpoint = endpoint
    .put
    .in("family")
    .in(path[String])
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic { case (id, family) => repo.flatMap(_.updateFamily(id, family)) }

  private val deleteFamilyEndpoint = endpoint
    .delete
    .in("family")
    .in(path[String])
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(id => repo.flatMap(_.removeFamily(id)))

  private val updatePersonEndpoint = endpoint
    .put
    .in("person")
    .in(path[String])
    .in(customJsonBody[PersonDescription])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic { case (id, person) => repo.flatMap(_.updatePerson(id, person)) }

  private val deletePersonEndpoint = endpoint
    .delete
    .in("person")
    .in(path[String])
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic(id => repo.flatMap(_.removePerson(id)))

  private val serviceEndpoints =
    getStemmaEndpoint ::
      newFamilyEndpoint ::
      updateFamilyEndpoint ::
      deleteFamilyEndpoint ::
      updatePersonEndpoint ::
      deletePersonEndpoint ::
      Nil

  private val serviceRoutes = ZHttp4sServerInterpreter().from(serviceEndpoints).toRoutes
  private val swaggerRoutes = ZHttp4sServerInterpreter()
    .from(SwaggerInterpreter().fromServerEndpoints(serviceEndpoints, "Stemma Service", "1.0"))
    .toRoutes

  override def run(args: List[String]): URIO[zio.ZEnv, ExitCode] = {
    import zio.interop.catz._

    val deps = (graph.newGraph >>> (storage.localGraphsonFile("stemma.graphson") ++ stemma.basic)) >>> stemma.durable
    BlazeServerBuilder[RIO[STEMMA with Clock with Blocking, *]]
      .bindHttp(8080, "localhost")
      .withHttpApp(
        Router(
          "/api/v1"  -> serviceRoutes,
          "/" -> swaggerRoutes
        ).orNotFound
      )
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
