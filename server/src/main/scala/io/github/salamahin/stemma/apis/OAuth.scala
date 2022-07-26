package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.domain.User
import io.github.salamahin.stemma.service.{OAuthService, UserService}
import zhttp.http._
import zio.ZIO

object OAuth {
  def authenticate[R, E](onSuccess: User => HttpApp[R, E]): Http[R with UserService with OAuthService, E, Request, Response] =
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
          userService <- ZIO.service[UserService]
          authService <- ZIO.service[OAuthService]

          token <- parseToken
          email <- authService.decode(token).mapError(err => HttpError.InternalServerError(cause = Some(err.cause)))
          user  <- userService.getOrCreateUser(email)
        } yield user

        user.fold(
          err => Http.error(err),
          user => onSuccess(user)
        )
      }
      .flatten
}
