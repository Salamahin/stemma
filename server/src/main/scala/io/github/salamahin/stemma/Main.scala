package io.github.salamahin.stemma

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http._
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{Clock, Console, RIO, Task, ZEnv, ZIO, ZIOAppArgs, ZIOAppDefault}

object Main extends ZIOAppDefault with LazyLogging {
  import io.circe.parser.decode
  import io.circe.syntax._

  type STEMMA_ENV     = OAuthService with UserService with StemmaService with Console with Clock
  type STEMMA_TASK[A] = RIO[STEMMA_ENV, A]

  private val userService   = ZIO.environment[UserService].map(_.get)
  private val stemmaService = ZIO.environment[StemmaService].map(_.get)
  private val authService   = ZIO.environment[OAuthService].map(_.get)

  private def authenticate[R, E](success: User => HttpApp[R, E]) =
    Http
      .fromFunctionZIO[Request] { request =>
        val parseToken = ZIO
          .fromOption {
            request.headerValue(HeaderNames.authorization)
          }
          .mapBoth(
            _ => HttpError.Forbidden(),
            _.replace("Bearer ", "")
          )

        val user = for {
          token <- parseToken
          email <- authService.flatMap(_.decode(token)).mapError(err => HttpError.InternalServerError(cause = Some(err.cause)))
          user  <- userService.flatMap(_.getOrCreateUser(email))
        } yield user

        user.fold(
          err => Http.error(err),
          user => success(user)
        )
      }
      .flatten

  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  private val application = authenticate { user =>
    Http.collectZIO[Request] {
      case Method.GET -> !! / "graph" =>
        logger.info(s"User ${user.userId} asked for owned graphs")
        stemmaService
          .flatMap(_.listOwnedGraphs(user.userId))
          .mapBoth(
            error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
            graphs => Response.json(graphs.asJson.noSpaces)
          )

      case req @ Method.POST -> !! / "graph" =>
        logger.info(s"User ${user.userId} requested a new graph creation")

        val newGraph: ZIO[StemmaService, StemmaError, GraphDescription] = for {
          body      <- req.bodyAsString.mapError(err => UnknownError(err))
          graphName <- Task.fromEither(decode[CreateGraph](body)).mapError(err => UnknownError(err))
          s         <- stemmaService
          graphId   <- s.createGraph(user.userId, graphName.name)
        } yield GraphDescription(graphId, graphName.name)

        newGraph
          .mapBoth(
            error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
            graphs => Response.json(graphs.asJson.noSpaces)
          )
    }
  } @@ cors(corsConfig)

//  val app = HttpRoutes.of[STEMMA_TASK] {
//    ???
//  }

//  private val getStemmaEndpoint = endpoint
//    .get
//    .in("stemma")
//    .in(authOAuth2)
//    .in(path[String].name("graphId"))
//    .out(customJsonBody[Stemma])
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, graphId) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.stemma(userId, graphId)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val listGraphsEndpoint = endpoint
//    .get
//    .in("graphs")
//    .in(authOAuth2)
//    .out(customJsonBody[OwnedGraphs])
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic { token => authenticateUser(token).flatMap(userId => stemma.flatMap(_.listOwnedGraphs(userId))) }
//    .widen[STEMMA_ENV]
//
//  private val newFamilyEndpoint = endpoint
//    .post
//    .in("family")
//    .in(authOAuth2)
//    .in(path[String].name("graphId"))
//    .in(customJsonBody[FamilyDescription])
//    .out(customJsonBody[Family])
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, graphid, familyDescr) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.createFamily(userId, graphid, familyDescr)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val updateFamilyEndpoint = endpoint
//    .put
//    .in("family")
//    .in(authOAuth2)
//    .in(path[String].name("familyId"))
//    .in(customJsonBody[FamilyDescription])
//    .out(customJsonBody[Family])
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, familyId, family) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.updateFamily(userId, familyId, family)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val deleteFamilyEndpoint = endpoint
//    .delete
//    .in("family")
//    .in(authOAuth2)
//    .in(path[String].name("familyId"))
//    .out(emptyOutput)
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, familyId) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.removeFamily(userId, familyId)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val updatePersonEndpoint = endpoint
//    .put
//    .in("person")
//    .in(authOAuth2)
//    .in(path[String].name("personId"))
//    .in(customJsonBody[PersonDescription])
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, personId, person) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.updatePerson(userId, personId, person)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val deletePersonEndpoint = endpoint
//    .delete
//    .in("person")
//    .in(authOAuth2)
//    .in(path[String].name("personId"))
//    .out(emptyOutput)
//    .errorOut(customJsonBody[StemmaError])
//    .zServerLogic {
//      case (token, personId) =>
//        authenticateUser(token).flatMap(userId => stemma.flatMap(_.removePerson(userId, personId)))
//    }
//    .widen[STEMMA_ENV]
//
//  private val serviceEndpoints =
//    getStemmaEndpoint ::
//      newFamilyEndpoint ::
//      updateFamilyEndpoint ::
//      deleteFamilyEndpoint ::
//      updatePersonEndpoint ::
//      deletePersonEndpoint ::
//      listGraphsEndpoint ::
//      Nil

//  override def run(args: List[String]): URIO[zio.ZEnv, ExitCode] = {
//    val deps = (SecretService.envSecret ++ OpsService.live) >+>
//      GraphService.postgres >>>
//      (OAuthService.googleSignIn ++ UserService.live ++ StemmaService.live)
//
//
//    val config = CORSConfig.default
//      .withAnyOrigin(false)
//      .withAllowedOrigins(Set("http://trusted.example.com"))
//
//    val cors = CORS(routes, config)
//
//    val serviceRoutes = ZHttp4sServerInterpreter().from(serviceEndpoints).toRoutes
//    val swaggerRoutes = ZHttp4sServerInterpreter()
//      .from(SwaggerInterpreter().fromServerEndpoints(serviceEndpoints, "Stemma Service", "1.0"))
//      .toRoutes
//
//    BlazeServerBuilder[STEMMA_TASK]
//      .bindHttp(8082, "localhost")
//      .withHttpApp(
//        Router(
//          "/" -> serviceRoutes,
//          "/" -> swaggerRoutes
//        ).orNotFound
//      )
//      .resource
//      .toManagedZIO
//      .useForever
//      .provideCustomLayer(deps)
//      .foldCauseM(
//        err => putStrLn(err.prettyPrint).exitCode,
//        _ => ZIO.succeed(zio.ExitCode.success)
//      )
//  }

  override def run: ZIO[ZEnv with ZIOAppArgs, Any, Any] = {
    val layers = (Secrets.envSecrets ++ OpsService.live) >+>
      GraphService.postgres >>>
      (StemmaService.live ++ UserService.live ++ OAuthService.googleSignIn)

    Server
      .start(8090, application)
      .exitCode
      .provideCustomLayer(layers)
  }
}
