package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.domain.User
import io.github.salamahin.stemma.service.{OAuthService, StemmaService, UserService}
import zhttp.http._
import zio.ZIO

trait WebApi {
  val userService   = ZIO.environment[UserService].map(_.get)
  val authService   = ZIO.environment[OAuthService].map(_.get)
  val stemmaService = ZIO.environment[StemmaService].map(_.get)

  def authenticate[R, E](success: User => HttpApp[R, E]): Http[R with UserService with OAuthService, E, Request, Response] =
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
}
