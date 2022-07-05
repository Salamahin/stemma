package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.circe.Encoder
import io.github.salamahin.stemma.domain.{CreateFamily, CreateStemma, StemmaDescription, StemmaError, UnknownError, User}
import io.github.salamahin.stemma.service.StemmaService
import zhttp.http._
import zio.ZIO

import java.net.URLDecoder

object StemmaApi extends LazyLogging {
  import io.circe.parser.decode
  import io.circe.syntax._

  object queryParam {
    def unapply(param: String) = Some(URLDecoder.decode(param, "UTF-8"))
  }

  implicit class StemmaOperationSyntax[R, T: Encoder](effect: ZIO[R, StemmaError, T]) {
    def toResponse() =
      effect
        .mapError(err => { logger.error(s"Service error: $err"); err })
        .mapBoth(
          error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
          stemmas => Response.json(stemmas.asJson.noSpaces)
        )
  }

  def api(user: User) =
    Http.collectZIO[Request] {
      case Method.GET -> !! / "stemma" =>
        logger.info(s"User ${user.userId} asked for owned stemmas")
        ZIO
          .service[StemmaService]
          .flatMap(_.listOwnedStemmas(user.userId))
          .toResponse()

      case req @ Method.POST -> !! / "stemma" =>
        logger.info(s"User ${user.userId} requested a new stemma creation")
        (for {
          body       <- req.bodyAsString.mapError(err => UnknownError(err))
          stemmaName <- ZIO.fromEither(decode[CreateStemma](body)).mapError(err => UnknownError(err))
          s          <- ZIO.service[StemmaService]
          stemmaId   <- s.createStemma(user.userId, stemmaName.name)
          _          = logger.debug(s"User ${user.userId} created a new stemma with id = $stemmaId, name = $stemmaName")
        } yield StemmaDescription(stemmaId, stemmaName.name)).toResponse()

      case Method.GET -> !! / "stemma" / queryParam(stemmaId) =>
        logger.info(s"User ${user.userId} requested stemma data with stemmaId = $stemmaId")
        ZIO
          .service[StemmaService]
          .flatMap(_.stemma(user.userId, stemmaId))
          .toResponse()

      case req @ Method.POST -> !! / "stemma" / queryParam(stemmaId) / "family" =>
        logger.info(s"User ${user.userId} requested a new family creation")
        (for {
          body     <- req.bodyAsString.mapError(err => UnknownError(err))
          family   <- ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err))
          s        <- ZIO.service[StemmaService]
          familyId <- s.createFamily(user.userId, stemmaId, family)
          _        = logger.debug(s"User ${user.userId} created a new family with id = $familyId")

          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()
    }
}
