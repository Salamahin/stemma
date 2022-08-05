package io.github.salamahin.stemma.apis.serverless.aws

import com.amazonaws.services.lambda.runtime
import com.amazonaws.services.lambda.runtime.RequestHandler
import com.amazonaws.services.lambda.runtime.events.{APIGatewayProxyRequestEvent, APIGatewayV2HTTPEvent}
import io.github.salamahin.stemma.apis.API
import io.github.salamahin.stemma.domain._
import zio.{Task, ZIO}
import zio.lambda.{Context, ZLambda}


class HelloWorld extends RequestHandler[APIGatewayV2HTTPEvent, String] {

  override def handleRequest(input: APIGatewayV2HTTPEvent, context: runtime.Context): String = {
    "OK" + System.currentTimeMillis()
  }
}

object ListStemma extends ZLambda[ListStemmasRequest, OwnedStemmasDescription] with Layers {
  override def apply(event: ListStemmasRequest, context: Context): Task[OwnedStemmasDescription] =
    API.listStemmas(event).provideSomeLayer(layers)
}

object BearInvitationStemma extends ZLambda[BearInvitationRequest, String] with Layers {
  override def apply(event: BearInvitationRequest, context: Context): Task[String] =
    API.bearInvitation(event).as("success").provideSomeLayer(layers)
}

object DeleteStemma extends ZLambda[DeleteStemmaRequest, OwnedStemmasDescription] with Layers {
  override def apply(event: DeleteStemmaRequest, context: Context): Task[OwnedStemmasDescription] =
    API.deleteStemma(event).provideSomeLayer(layers)
}

object CreateNewStemma extends ZLambda[CreateNewStemmaRequest, StemmaDescription] with Layers {
  override def apply(event: CreateNewStemmaRequest, context: Context): Task[StemmaDescription] =
    API.createNewStemma(event).provideSomeLayer(layers)
}

object Stemma extends ZLambda[GetStemmaRequest, Stemma] with Layers {
  override def apply(event: GetStemmaRequest, context: Context): Task[Stemma] =
    API.stemma(event).provideSomeLayer(layers)
}

object DeletePerson extends ZLambda[DeletePersonRequest, Stemma] with Layers {
  override def apply(event: DeletePersonRequest, context: Context): Task[Stemma] =
    API.deletePerson(event).provideSomeLayer(layers)
}

object UpdatePerson extends ZLambda[UpdatePersonRequest, Stemma] with Layers {
  override def apply(event: UpdatePersonRequest, context: Context): Task[Stemma] =
    API.updatePerson(event).provideSomeLayer(layers)
}

object CreateInvitationToken extends ZLambda[CreateInvitationTokenRequest, String] with Layers {
  override def apply(event: CreateInvitationTokenRequest, context: Context): Task[String] =
    API.createInvitationToken(event).provideSomeLayer(layers)
}

object CreateFamily extends ZLambda[CreateFamilyRequest, Stemma] with Layers {
  override def apply(event: CreateFamilyRequest, context: Context): Task[Stemma] =
    API.createFamily(event).provideSomeLayer(layers)
}

object UpdateFamily extends ZLambda[UpdateFamilyRequest, Stemma] with Layers {
  override def apply(event: UpdateFamilyRequest, context: Context): Task[Stemma] =
    API.updateFamily(event).provideSomeLayer(layers)
}

object DeleteFamily extends ZLambda[DeleteFamilyRequest, Stemma] with Layers {
  override def apply(event: DeleteFamilyRequest, context: Context): Task[Stemma] =
    API.deleteFamily(event).provideSomeLayer(layers)
}
