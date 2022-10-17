package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain.{RequestDeserializationProblem, StemmaError}
import zio.json.{DecoderOps, EncoderOps, JsonDecoder, JsonEncoder}
import zio.{Exit, IO, Runtime, Unsafe, ZIO}

import java.util.Base64

abstract class LambdaRunner[In, Out](implicit jsonDecoder: JsonDecoder[In], jsonEncoder: JsonEncoder[Out]) extends LazyLogging {
  def run(email: String, request: In): IO[StemmaError, Out]

  final def apply(input: APIGatewayV2HTTPEvent, context: Context) = {
    logger.info("Hello world!")

    val email = ZIO.succeed(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"))

    val request = ZIO
      .attempt(new String(Base64.getDecoder.decode(input.getBody)))
      .tap(body => ZIO.succeed(logger.debug(s"Received request body: $body")))
      .flatMap(str => ZIO.fromEither(str.fromJson[In]))
      .mapError(err => RequestDeserializationProblem(s"Failed to deser the request, details: $err"))

    val zio = (for {
      (email, body) <- email <&> request
      res           <- run(email, body)
    } yield res)
      .tapError(err => ZIO.succeed(logger.error("Error occurred", err)))
      .fold(
        err => err.toJson,
        res => res.toJson
      )
      .tap(resp => ZIO.succeed(logger.debug(s"Generated response (truncated): ${resp.take(100)}")))

    Unsafe.unsafe { implicit u =>
      Runtime.default.unsafe.run(ZIO.succeed(logger.info("Unsafe started")) *> zio <* ZIO.succeed(logger.info("Done"))) match {
        case Exit.Success(successJson) => successJson
      }
    }
  }
}
