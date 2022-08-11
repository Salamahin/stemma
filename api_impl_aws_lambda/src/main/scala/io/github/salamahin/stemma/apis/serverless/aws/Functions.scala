package io.github.salamahin.stemma.apis.serverless.aws

import io.github.salamahin.stemma.apis.API
import io.github.salamahin.stemma.apis.serverless.aws.Layers.layers
import io.github.salamahin.stemma.domain._

import java.util.Base64

class ListStemmas extends Lambda[String, OwnedStemmasDescription] {
  def run(email: String, request: String) = API.listStemmas(email).provideSomeLayer(layers)
}

class BearInvitationStemma extends Lambda[String, String] {
  def run(email: String, body: String) = {
    API
      .bearInvitation(email, body)
      .as("success")
      .provideSomeLayer(layers)
  }
}

class DeleteStemma extends Lambda[String, OwnedStemmasDescription] {
  def run(email: String, body: String) = {
    API
      .deleteStemma(email, new String(Base64.getDecoder.decode(body)))
      .provideSomeLayer(layers)
  }
}

class CreateNewStemma extends Lambda[String, StemmaDescription] {
  def run(email: String, body: String) = {
    API.createNewStemma(email, new String(Base64.getDecoder.decode(body))).provideSomeLayer(layers)
  }
}

class GetStemma extends Lambda[String, Stemma] {
  def run(email: String, body: String) = {
    API.stemma(email, body).provideSomeLayer(layers)
  }
}

class DeletePerson extends Lambda[DeletePersonRequest, Stemma] {
  def run(email: String, request: DeletePersonRequest) = {
    API
      .deletePerson(email, request)
      .provideSomeLayer(layers)
  }
}

class UpdatePerson extends Lambda[UpdatePersonRequest, Stemma] {
  def run(email: String, request: UpdatePersonRequest) = {
    API
      .updatePerson(email, request)
      .provideSomeLayer(layers)
  }
}

class CreateInvitationToken extends Lambda[CreateInvitationTokenRequest, String] {
  def run(email: String, request: CreateInvitationTokenRequest) = {
    API
      .createInvitationToken(email, request)
      .provideSomeLayer(layers)
  }
}

class CreateFamily extends Lambda[CreateFamilyRequest, Stemma] {
  def run(email: String, request: CreateFamilyRequest) = {
    API
      .createFamily(email, request)
      .provideSomeLayer(layers)
  }
}

class UpdateFamily extends Lambda[UpdateFamilyRequest, Stemma] {
  def run(email: String, request: UpdateFamilyRequest) = {
    API
      .updateFamily(email, request)
      .provideSomeLayer(layers)
  }
}

class DeleteFamily extends Lambda[DeleteFamilyRequest, Stemma] {
  def run(email: String, request: DeleteFamilyRequest) = {
    API
      .deleteFamily(email, request)
      .provideSomeLayer(layers)
  }
}
