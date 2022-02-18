package io.github.salamahin.stemma.apis

import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain.{CreateGraph, GraphDescription, StemmaError, UnknownError}
import zhttp.http._
import zio.Task

trait GraphApi {
  this: WebApi with LazyLogging =>

  import io.circe.parser.decode
  import io.circe.syntax._

  val graphApis = authenticate { user =>
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

        val newGraph = for {
          body      <- req.bodyAsString.mapError(err => UnknownError(err))
          graphName <- Task.fromEither(decode[CreateGraph](body)).mapError(err => UnknownError(err))
          s         <- stemmaService
          graphId   <- s.createGraph(user.userId, graphName.name)
        } yield GraphDescription(graphId, graphName.name)

        newGraph.mapBoth(
          error => HttpError.BadRequest((error: StemmaError).asJson.noSpaces),
          graphs => Response.json(graphs.asJson.noSpaces)
        )
    }
  }
}
