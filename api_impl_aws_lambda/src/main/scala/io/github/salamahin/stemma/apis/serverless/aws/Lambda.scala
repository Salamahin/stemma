package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.domain.{RequestDeserializationProblem, StemmaError}
import zio.json.{DecoderOps, DeriveJsonEncoder, EncoderOps, JsonDecoder, JsonEncoder}
import zio.{Exit, Runtime, Unsafe, ZIO}

import java.util.Base64

case class AwsLambdaException(errorType: String, httpStatus: Int, requestId: String, message: StemmaError)
object AwsLambdaException {
  implicit val enc = DeriveJsonEncoder.gen[AwsLambdaException]
}

abstract class Lambda[In, Out](implicit jsonDecoder: JsonDecoder[In], jsonEncoder: JsonEncoder[Out]) extends LazyLogging {
  def run(email: String, request: In): ZIO[Any, StemmaError, Out]

  final def apply(input: APIGatewayV2HTTPEvent, context: Context) = {
    val email = ZIO.succeed(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"))

    val request = ZIO
      .attempt(new String(Base64.getDecoder.decode(input.getBody)))
      .map { body =>
        logger.debug(s"Received request body: ${body}")
        body
      }
      .flatMap(str => ZIO.fromEither(str.fromJson[In]))
      .mapError(err => RequestDeserializationProblem(s"Failed to deser the request, details: ${err}"))

    val zio = for {
      (email, body) <- email <&> request
      res           <- run(email, body)
      json          = res.toJson
      _             = logger.debug(s"Generated response: ${json}")
    } yield json

    Unsafe.unsafe { implicit u =>
      Runtime.default.unsafe.run(zio) match {
        case Exit.Success(json) => json
        case Exit.Failure(cause) =>
          logger.error(s"Unexpected error", cause.squash)
          AwsLambdaException("BadRequest", 400, context.getAwsRequestId, cause.failureOption.get).toJson
      }
    }
  }
}
