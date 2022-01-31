package io.github.salamahin.stemma

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.OAuthService.OAUTH
import io.github.salamahin.stemma.service.StemmaService.STEMMA
import io.github.salamahin.stemma.service.UserService.USER
import org.http4s.blaze.server.BlazeServerBuilder
import org.http4s.server.Router
import org.http4s.server.middleware.Logger
import sttp.tapir.TapirAuth.oauth2
import sttp.tapir.server.http4s.ztapir.ZHttp4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter
import zio.blocking.Blocking
import zio.clock.Clock
import zio.console.{Console, putStrLn}
import zio.{ExitCode, RIO, URIO, ZIO}

object Main extends zio.App with Discriminated {
  import sttp.tapir.generic.auto._
  import sttp.tapir.json.circe._
  import sttp.tapir.ztapir._
  import zio.interop.catz._

  type STEMMA_ENV     = OAUTH with USER with STEMMA with Console with Clock with Blocking
  type STEMMA_TASK[A] = RIO[STEMMA_ENV, A]

  private val authOAuth2 = oauth2.authorizationCode()

  private val user   = ZIO.environment[USER].map(_.get)
  private val stemma = ZIO.environment[STEMMA].map(_.get)
  private val auth   = ZIO.environment[OAUTH].map(_.get)

  private def authenticateUser(token: String) =
    for {
      email <- auth.flatMap(_.decode(token))
      user  <- user.flatMap(_.getOrCreateUser(email))
    } yield user.userId

  private val getStemmaEndpoint = endpoint
    .get
    .in("stemma")
    .in(authOAuth2)
    .in(path[String].name("graphId"))
    .out(customJsonBody[Stemma])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, graphId) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.stemma(userId, graphId)))
    }
    .widen[STEMMA_ENV]

  private val newFamilyEndpoint = endpoint
    .post
    .in("family")
    .in(authOAuth2)
    .in(path[String].name("graphId"))
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, graphid, familyDescr) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.createFamily(userId, graphid, familyDescr)))
    }
    .widen[STEMMA_ENV]

  private val updateFamilyEndpoint = endpoint
    .put
    .in("family")
    .in(authOAuth2)
    .in(path[String].name("familyId"))
    .in(customJsonBody[FamilyDescription])
    .out(customJsonBody[Family])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, familyId, family) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.updateFamily(userId, familyId, family)))
    }
    .widen[STEMMA_ENV]

  private val deleteFamilyEndpoint = endpoint
    .delete
    .in("family")
    .in(authOAuth2)
    .in(path[String].name("familyId"))
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, familyId) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.removeFamily(userId, familyId)))
    }
    .widen[STEMMA_ENV]

  private val updatePersonEndpoint = endpoint
    .put
    .in("person")
    .in(authOAuth2)
    .in(path[String].name("personId"))
    .in(customJsonBody[PersonDescription])
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, personId, person) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.updatePerson(userId, personId, person)))
    }
    .widen[STEMMA_ENV]

  private val deletePersonEndpoint = endpoint
    .delete
    .in("person")
    .in(authOAuth2)
    .in(path[String].name("personId"))
    .out(emptyOutput)
    .errorOut(customJsonBody[StemmaError])
    .zServerLogic {
      case (token, personId) =>
        authenticateUser(token).flatMap(userId => stemma.flatMap(_.removePerson(userId, personId)))
    }
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
//    val deps = ((graph.newGraph >+> repo.repo) >>> (storage.localGraphsonFile("stemma.graphson") ++ stemma.basic)) >>> stemma.durable

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

//    BlazeServerBuilder[STEMMA_TASK]
//      .bindHttp(8080, "localhost")
//      .withHttpApp(httpApp)
//      .resource
//      .toManagedZIO
//      .useForever
//      .provideCustomLayer(deps)
//      .foldCauseM(
//        err => putStrLn(err.prettyPrint).exitCode,
//        _ => ZIO.succeed(zio.ExitCode.success)
//      )

    ???
  }
}
