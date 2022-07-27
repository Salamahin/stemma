package io.github.salamahin.stemma.apis.rest

import com.typesafe.scalalogging.LazyLogging
import io.circe.Encoder
import io.github.salamahin.stemma.apis._
import io.github.salamahin.stemma.domain.{CreateFamily, CreateNewPerson, MissingBearerHeader, StemmaError, UnknownError}
import io.github.salamahin.stemma.service._
import zhttp.http.Middleware.cors
import zhttp.http.middleware.Cors.CorsConfig
import zhttp.service.Server
import zio.{DefaultServices, Scope, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

import java.net.URLDecoder

object RestApi extends ZIOAppDefault with LazyLogging {
  import io.circe.parser.decode
  import io.circe.syntax._
  import zhttp.http._

  object queryParam {
    def unapply(param: String) = Some(URLDecoder.decode(param, "UTF-8"))
  }

  implicit class StemmaOperationSyntax[R, T: Encoder](effect: ZIO[R, StemmaError, T]) {
    def toResponse() =
      effect
        .mapBoth(
          error => HttpError.InternalServerError((error: StemmaError).asJson.noSpaces),
          result => Response.json(result.asJson.noSpaces)
        )
  }

  private val auth = Http
    .fromFunctionZIO[Request] { request =>
      ZIO
        .fromOption {
          request.headerValue(HeaderNames.authorization)
        }
        .mapBoth(
          _ => MissingBearerHeader(),
          _.replace("Bearer ", "")
        )
    }

  private def restWrapper(bearerToken: String) = Http.collectZIO[Request] {
    case Method.GET -> !! / "stemma" => Api.listStemmas(ListStemmasRequest(bearerToken)).toResponse()

    case Method.GET -> !! / "stemma" / queryParam(stemmaId) => Api.stemma(GetStemmaRequest(bearerToken, stemmaId)).toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) => Api.deleteStemma(DeleteStemmaRequest(bearerToken, stemmaId)).toResponse()

    case req @ Method.POST -> !! / "stemma" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(stemmaName => Api.createNewStemma(CreateNewStemmaRequest(bearerToken, stemmaName)))
        .toResponse()

    case req @ Method.PUT -> !! / "invitation" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(token => Api.bearInvitation(BearInvitationRequest(bearerToken, token)))
        .toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
      Api.deletePerson(DeletePersonRequest(bearerToken, stemmaId, personId)).toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(str => ZIO.fromEither(decode[CreateNewPerson](str)).mapError(err => UnknownError(err)))
        .flatMap(desrc => Api.updatePerson(UpdatePersonRequest(bearerToken, stemmaId, personId, desrc)))
        .toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(_) / "person" / queryParam(personId) / "invite" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(email => Api.createInvitationToken(CreateInvitationTokenRequest(bearerToken, personId, email)))
        .toResponse()

    case req @ Method.POST -> !! / "stemma" / queryParam(stemmaId) / "family" =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(body => ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err)))
        .flatMap(descr => Api.createFamily(CreateFamilyRequest(bearerToken, stemmaId, descr)))
        .toResponse()

    case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
      Api.deleteFamily(DeleteFamilyRequest(bearerToken, stemmaId, familyId)).toResponse()

    case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
      req
        .bodyAsString
        .mapError(err => UnknownError(err))
        .flatMap(body => ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err)))
        .flatMap(descr => Api.updateFamily(UpdateFamilyRequest(bearerToken, stemmaId, familyId, descr)))
        .toResponse()
  }

  private val corsConfig = CorsConfig(
    anyOrigin = false,
    allowedOrigins = _ contains "localhost" //fixme configure?
  )

  override def run: ZIO[Environment with ZIOAppArgs with Scope, Any, Any] = {
    val program = auth.flatMap(bearerToken => restWrapper(bearerToken)) @@ cors(corsConfig)

    (Server.start(8090, program) <&> ZIO.succeed(logger.info("Hello stemma")))
      .exitCode
      .provideSome(
        Secrets.envSecrets,
        GraphService.postgres,
        StemmaService.live,
        UserService.live,
        OAuthService.googleSignIn,
        ZLayer.succeedEnvironment(DefaultServices.live)
      )
  }
}
