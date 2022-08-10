package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import io.github.salamahin.stemma.apis.API
import io.github.salamahin.stemma.domain._
import zio.ZIO
import zio.json.DeriveJsonEncoder

case class TimeLogin(login: String, ts: Long, users: String)

class HelloWorld extends Lambda with Layers {
  implicit val enc = DeriveJsonEncoder.gen[TimeLogin]

  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    val email = input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email")
    val jdbcUrl = System.getenv("JDBC_URL")
    val jdbcUser = System.getenv("JDBC_USER")
    val jdbcPassword = System.getenv("JDBC_PASSWORD")
    val users = new SelectDemo(jdbcUrl, jdbcUser, jdbcPassword).selectUsers()
    ZIO.succeed(TimeLogin(email, System.currentTimeMillis(), users.toList.map(d => d.email).mkString("\n")))
  }
}


class ListStemmas extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .listStemmas(context.getIdentity.getIdentityId)
      .provideSomeLayer(layers)
  }
}

class BearInvitationStemma extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .bearInvitation(context.getIdentity.getIdentityId, input.getBody)
      .as("success")
      .provideSomeLayer(layers)
  }
}

class DeleteStemma extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .deleteStemma(context.getIdentity.getIdentityId, input.getBody)
      .provideSomeLayer(layers)
  }
}

class CreateNewStemma extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API.createNewStemma(context.getIdentity.getIdentityId, input.getBody).provideSomeLayer(layers)
  }
}

class Stemma extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API.stemma(context.getIdentity.getIdentityId, input.getBody).provideSomeLayer(layers)
  }
}

class DeletePerson extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[DeletePersonRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser delete person request, details: ${err}"))
      .flatMap(request => API.deletePerson(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}

class UpdatePerson extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[UpdatePersonRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser update person request, details: ${err}"))
      .flatMap(request => API.updatePerson(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}

class CreateInvitationToken extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[CreateInvitationTokenRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create invite token request, details: ${err}"))
      .flatMap(request => API.createInvitationToken(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}

class CreateFamily extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[CreateFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create family request, details: ${err}"))
      .flatMap(request => API.createFamily(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}

class UpdateFamily extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[UpdateFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create update family request, details: ${err}"))
      .flatMap(request => API.updateFamily(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}

class DeleteFamily extends Lambda with Layers {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[DeleteFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser delete family request, details: ${err}"))
      .flatMap(request => API.deleteFamily(context.getIdentity.getIdentityId, request))
      .provideSomeLayer(layers)
  }
}
