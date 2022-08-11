package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime.Context
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent
import io.github.salamahin.stemma.apis.API
import io.github.salamahin.stemma.apis.serverless.aws.Layers.layers
import io.github.salamahin.stemma.domain._
import zio.ZIO

import java.time.Instant

class ListStemmas extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .listStemmas(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"))
      .provideSomeLayer(layers)
  }
}

object ListStemmasApp extends App with Lambda {
  println(Instant.now)
  runUnsafe {
    API
      .listStemmas("user@email.com")
      .provideSomeLayer(layers)
  }
  println(Instant.now)
}

class BearInvitationStemma extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .bearInvitation(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), input.getBody)
      .as("success")
      .provideSomeLayer(layers)
  }
}

class DeleteStemma extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API
      .deleteStemma(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), input.getBody)
      .provideSomeLayer(layers)
  }
}

class CreateNewStemma extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API.createNewStemma(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), input.getBody).provideSomeLayer(layers)
  }
}

class Stemma extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    API.stemma(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), input.getBody).provideSomeLayer(layers)
  }
}

class DeletePerson extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[DeletePersonRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser delete person request, details: ${err}"))
      .flatMap(request => API.deletePerson(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}

class UpdatePerson extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[UpdatePersonRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser update person request, details: ${err}"))
      .flatMap(request => API.updatePerson(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}

class CreateInvitationToken extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[CreateInvitationTokenRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create invite token request, details: ${err}"))
      .flatMap(request => API.createInvitationToken(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}

class CreateFamily extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[CreateFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create family request, details: ${err}"))
      .flatMap(request => API.createFamily(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}

class UpdateFamily extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[UpdateFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser create update family request, details: ${err}"))
      .flatMap(request => API.updateFamily(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}

class DeleteFamily extends Lambda {
  def apply(input: APIGatewayV2HTTPEvent, context: Context) = runUnsafe {
    import zio.json._

    ZIO
      .fromEither(input.getBody.fromJson[DeleteFamilyRequest])
      .mapError(err => RequestDeserializationProblem(s"Failed to deser delete family request, details: ${err}"))
      .flatMap(request => API.deleteFamily(input.getRequestContext.getAuthorizer.getJwt.getClaims.get("email"), request))
      .provideSomeLayer(layers)
  }
}
