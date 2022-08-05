package io.github.salamahin.stemma.apis.rest

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.API
import io.github.salamahin.stemma.domain.{
  BearInvitationRequest,
  CreateFamily,
  CreateFamilyRequest,
  CreateInvitationTokenRequest,
  CreateNewPerson,
  CreateNewStemmaRequest,
  DeleteFamilyRequest,
  DeletePersonRequest,
  DeleteStemmaRequest,
  GetStemmaRequest,
  ListStemmasRequest,
  MissingAuthHeader,
  StemmaError,
  UnknownError,
  UpdateFamilyRequest,
  UpdatePersonRequest
}
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{DefaultServices, Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

import java.net.URLDecoder

object RestApi extends ZIOAppDefault with LazyLogging {
  import zio.json._
  import zhttp.http._

  object queryParam {
    def unapply(param: String) = Some(URLDecoder.decode(param, "UTF-8"))
  }

  implicit class StemmaOperationSyntax[R, T: JsonEncoder](effect: ZIO[R, StemmaError, T]) {
    def toResponse() =
      effect
        .mapBoth(
          error => HttpError.InternalServerError(error.toJson),
          result => Response.json(result.toJson)
        )
  }

  private val auth = Http
    .fromFunctionZIO[Request] { request =>
      for {
        oauth <- ZIO.service[OAuthService]
        token <- ZIO
                  .fromOption(request.headerValue(HeaderNames.authorization))
                  .mapBoth(
                    _ => MissingAuthHeader(),
                    _.replace("Bearer ", "")
                  )
        email <- oauth.decode(token)
      } yield email
    }

  private def restWrapper(userEmail: String) = Http.collectZIO[Request] {
    case Method.GET -> !! / "stemma" => API.listStemmas(ListStemmasRequest(userEmail)).toResponse()

    case Method.GET -> !! / "stemma" / queryParam(stemmaId) => API.stemma(GetStemmaRequest(userEmail, stemmaId)).toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) => API.deleteStemma(DeleteStemmaRequest(userEmail, stemmaId)).toResponse()

    case req @ Method.POST -> !! / "stemma" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(stemmaName => API.createNewStemma(CreateNewStemmaRequest(userEmail, stemmaName)))
        .toResponse()

    case req @ Method.PUT -> !! / "invitation" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(token => API.bearInvitation(BearInvitationRequest(userEmail, token)).as("success"))
        .toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
      API.deletePerson(DeletePersonRequest(userEmail, stemmaId, personId)).toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(str => ZIO.fromEither(str.fromJson[CreateNewPerson]).mapError(err => UnknownError(new IllegalStateException(err))))
        .flatMap(desrc => API.updatePerson(UpdatePersonRequest(userEmail, stemmaId, personId, desrc)))
        .toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(_) / "person" / queryParam(personId) / "invite" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(email => API.createInvitationToken(CreateInvitationTokenRequest(userEmail, personId, email)))
        .toResponse()

    case req @ Method.POST -> !! / "stemma" / queryParam(stemmaId) / "family" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(body => ZIO.fromEither(body.fromJson[CreateFamily]).mapError(err => UnknownError(new IllegalStateException(err))))
        .flatMap(descr => API.createFamily(CreateFamilyRequest(userEmail, stemmaId, descr)))
        .toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
      API.deleteFamily(DeleteFamilyRequest(userEmail, stemmaId, familyId)).toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(body => ZIO.fromEither(body.fromJson[CreateFamily]).mapError(err => UnknownError(new IllegalStateException(err))))
        .flatMap(descr => API.updateFamily(UpdateFamilyRequest(userEmail, stemmaId, familyId, descr)))
        .toResponse()
  }

  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    val program = (auth >>= restWrapper) @@ cors(corsConfig)

    (Server.start(8090, program) <&> ZIO.succeed(logger.info("Hello stemma")))
      .tapError(err => ZIO.succeed(logger.error("Unexpected error", err)))
      .exitCode
      .provideSome(
        UserSecrets.fromEnv,
        JdbcConfiguration.fromEnv,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        Google.fromEnv,
        OAuthService.googleSignIn,
        ZLayer.succeedEnvironment(DefaultServices.live)
      )
  }
}
