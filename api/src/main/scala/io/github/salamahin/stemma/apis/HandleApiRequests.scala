package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{StorageService, UserService}
import zio.ZIO

trait HandleApiRequests {
  def handle(email: String, req: Request): ZIO[UserService with StorageService, Throwable, Response] = req match {
    case ListStemmasRequest()                        => API.listStemmas(email)
    case req @ CreateFamilyRequest(_, _)             => API.createFamily(email, req)
    case req @ CreateInvitationTokenRequest(_, _, _) => API.createInvitationToken(email, req)
    case req @ CreateNewStemmaRequest(_)             => API.createNewStemma(email, req)
    case req @ DeleteFamilyRequest(_, _)             => API.deleteFamily(email, req)
    case req @ DeletePersonRequest(_, _)             => API.deletePerson(email, req)
    case req @ GetStemmaRequest(_)                   => API.stemma(email, req)
    case req @ DeleteStemmaRequest(_)                => API.deleteStemma(email, req)
    case req @ UpdatePersonRequest(_, _, _)          => API.updatePerson(email, req)
    case req @ UpdateFamilyRequest(_, _, _)          => API.updateFamily(email, req)
    case req @ BearInvitationRequest(_)              => API.bearInvitation(email, req)
  }
}
