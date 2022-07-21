package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.circe.Encoder
import io.github.salamahin.stemma.domain.{CreateFamily, CreateNewPerson, CreateStemma, StemmaDescription, StemmaError, UnknownError, User}
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
          result => Response.json(result.asJson.noSpaces)
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

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) =>
        logger.info(s"User ${user.userId} asked to remove stemma with id = $stemmaId")
        (for {
          s       <- ZIO.service[StemmaService]
          _       <- s.removeStemma(user.userId, stemmaId)
          stemmas <- s.listOwnedStemmas(user.userId)
          _       = logger.debug(stemmas.toString)
        } yield stemmas).toResponse()

      case req @ Method.POST -> !! / "stemma" =>
        logger.info(s"User ${user.userId} requested a new stemma creation")
        (for {
          body       <- req.bodyAsString.mapError(err => UnknownError(err))
          stemmaName <- ZIO.fromEither(decode[CreateStemma](body)).mapError(err => UnknownError(err))
          s          <- ZIO.service[StemmaService]
          stemmaId   <- s.createStemma(user.userId, stemmaName.name)
          _          = logger.debug(s"User ${user.userId} created a new stemma with id = $stemmaId, name = $stemmaName")
        } yield StemmaDescription(stemmaId, stemmaName.name, removable = true)).toResponse()

      case Method.GET -> !! / "stemma" / queryParam(stemmaId) =>
        logger.info(s"User ${user.userId} requested stemma data with stemmaId = $stemmaId")
        ZIO
          .service[StemmaService]
          .flatMap(_.stemma(user.userId, stemmaId))
          .toResponse()

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
        logger.info(s"User ${user.userId} requested to remove a person with id = $personId")
        (for {
          s      <- ZIO.service[StemmaService]
          _      <- s.removePerson(user.userId, personId)
          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "person" / queryParam(personId) =>
        logger.info(s"User ${user.userId} requested to update a person with id = $personId")
        (for {
          s           <- ZIO.service[StemmaService]
          body        <- req.bodyAsString.mapError(err => UnknownError(err))
          personDescr <- ZIO.fromEither(decode[CreateNewPerson](body)).mapError(err => UnknownError(err))
          _           <- s.updatePerson(user.userId, personId, personDescr)
          stemma      <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.POST -> !! / "stemma" / queryParam(stemmaId) / "family" =>
        logger.info(s"User ${user.userId} requested a new family creation")
        (for {
          body     <- req.bodyAsString.mapError(err => UnknownError(err))
          family   <- ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err))
          s        <- ZIO.service[StemmaService]
          familyId <- s.createFamily(user.userId, stemmaId, family)
          _        = logger.debug(s"User ${user.userId} created a new family with descr = $familyId")

          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case Method.DELETE -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
        logger.info(s"User ${user.userId} requested to remove a family with id = $familyId")
        (for {
          s      <- ZIO.service[StemmaService]
          _      <- s.removeFamily(user.userId, familyId)
          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()

      case req @ Method.PUT -> !! / "stemma" / queryParam(stemmaId) / "family" / queryParam(familyId) =>
        logger.info(s"User ${user.userId} requested to update a family composition with id = $familyId")
        (for {
          body   <- req.bodyAsString.mapError(err => UnknownError(err))
          family <- ZIO.fromEither(decode[CreateFamily](body)).mapError(err => UnknownError(err))

          s <- ZIO.service[StemmaService]
          _ <- s.updateFamily(user.userId, familyId, family)

          stemma <- s.stemma(user.userId, stemmaId)
        } yield stemma).toResponse()
    }
}
