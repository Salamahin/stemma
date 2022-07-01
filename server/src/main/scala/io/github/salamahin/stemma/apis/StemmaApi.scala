package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain.{CreateStemma, StemmaDescription, StemmaError, UnknownError, User}
import io.github.salamahin.stemma.service.StemmaService
import zhttp.http._
import zio.ZIO

object StemmaApi extends LazyLogging {
  import io.circe.parser.decode
  import io.circe.syntax._

  def api(user: User) =
    Http.collectZIO[Request] {
      case Method.GET -> !! / "stemma" =>
        logger.info(s"User ${user.userId} asked for owned stemmas")

        ZIO
          .service[StemmaService]
          .flatMap(_.listOwnedStemmas(user.userId))
          .mapBoth(
            error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
            stemmas => Response.json(stemmas.asJson.noSpaces)
          )

      case req @ Method.POST -> !! / "stemma" =>
        logger.info(s"User ${user.userId} requested a new stemma creation")

        val newGraph = for {
          body       <- req.bodyAsString.mapError(err => UnknownError(err))
          stemmaName <- ZIO.fromEither(decode[CreateStemma](body)).mapError(err => UnknownError(err))
          s          <- ZIO.service[StemmaService]
          stemmaId   <- s.createStemma(user.userId, stemmaName.name)
        } yield StemmaDescription(stemmaId, stemmaName.name)

        newGraph.mapBoth(
          error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
          stemmas => Response.json(stemmas.asJson.noSpaces)
        )
    }
}
