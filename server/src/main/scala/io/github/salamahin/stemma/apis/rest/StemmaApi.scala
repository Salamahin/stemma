package io.github.salamahin.stemma.apis.rest

import io.circe.Encoder
import io.github.salamahin.stemma.domain.{CreateFamily, CreateNewPerson, ForeignInviteToken, StemmaDescription, StemmaError, UnknownError, User}
import io.github.salamahin.stemma.service.{StemmaService, UserService}
import zio.ZIO

import java.net.URLDecoder

object StemmaApi {
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

  def api(user: User) =
    Http.collectZIO[Request] {
      case Method.GET -> !! / "stemma" =>
        ZIO
          .service[StemmaService]
          .flatMap(_.listOwnedStemmas(user.userId))
          .toResponse()

      case req @ Method.PUT -> !! / "invitation" =>
        (for {
          s     <- ZIO.service[StemmaService]
          token <- req.bodyAsString.mapError(err => UnknownError(err))
          us    <- ZIO.service[UserService]
          token <- us.decodeInviteToken(token)

          _ <- ZIO.fromEither(if (token.inviteesEmail == user.email) Right() else Left(ForeignInviteToken()))

          _ <- s.chown(user.userId, token.targetPersonId)
        } yield ()).toResponse()

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) =>
        (for {
          s       <- ZIO.service[StemmaService]
          _       <- s.removeStemma(user.userId, stemmaId)
          stemmas <- s.listOwnedStemmas(user.userId)
        } yield stemmas).toResponse()

      case req @ Method.POST -> !! / "stemma" =>
        (for {
          stemmaName       <- req.bodyAsString.mapError(err => UnknownError(err))
          s          <- ZIO.service[StemmaService]
          stemmaId   <- s.createStemma(user.userId, stemmaName)
        } yield StemmaDescription(stemmaId, stemmaName, removable = true)).toResponse()

      case Method.GET -> !! / "stemma" / queryParam(stemmaId) =>
        ZIO
          .service[StemmaService]
          .flatMap(_.stemma(user.userId, stemmaId))
          .toResponse()

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
        (for {
          s      <- ZIO.service[StemmaService]
          _      <- s.removePerson(user.userId, personId)
          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
        (for {
          s           <- ZIO.service[StemmaService]
          body        <- req.bodyAsString.mapError(err => UnknownError(err))
          personDescr <- ZIO.fromEither(decode[CreateNewPerson](body)).mapError(err => UnknownError(err))
          _           <- s.updatePerson(user.userId, personId, personDescr)
          stemma      <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.PUT -> !! / "stemma" / queryParam(_) / "person" / queryParam(personId) / "invite" =>
        (for {
          us         <- ZIO.service[UserService]
          email       <- req.bodyAsString.mapError(err => UnknownError(err))
          inviteLink <- us.createInviteToken(email, personId)
        } yield inviteLink).toResponse()

      case req @ Method.POST -> !! / "stemma" / queryParam(stemmaId) / "family" =>
        (for {
          body     <- req.bodyAsString.mapError(err => UnknownError(err))
          family   <- ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err))
          s        <- ZIO.service[StemmaService]
          familyId <- s.createFamily(user.userId, stemmaId, family)

          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
        (for {
          s      <- ZIO.service[StemmaService]
          _      <- s.removeFamily(user.userId, familyId)
          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
        (for {
          body   <- req.bodyAsString.mapError(err => UnknownError(err))
          family <- ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err))

          s <- ZIO.service[StemmaService]
          _ <- s.updateFamily(user.userId, familyId, family)

          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()
    }
}
