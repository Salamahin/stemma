package io.github.salamahin.stemma.apis

import io.github.salamahin.stemma.domain._
import zio.{IO, URLayer, ZIO, ZLayer}

trait HandleApiRequestService {
  def handle(email: String, req: Request): IO[StemmaError, Response]
}

object HandleApiRequestService {
  val live: URLayer[ApiService, HandleApiRequestService] = ZLayer.fromZIO(for {
    api <- ZIO.service[ApiService]
  } yield new HandleApiRequestService {
    override def handle(email: String, req: Request): IO[StemmaError, Response] = req match {
      case ListStemmasRequest()                        => api.listStemmas(email)
      case req @ CreateFamilyRequest(_, _)             => api.createFamily(email, req)
      case req @ CreateInvitationTokenRequest(_, _, _) => api.createInvitationToken(email, req)
      case req @ CreateNewStemmaRequest(_)             => api.createNewStemma(email, req)
      case req @ DeleteFamilyRequest(_, _)             => api.deleteFamily(email, req)
      case req @ DeletePersonRequest(_, _)             => api.deletePerson(email, req)
      case req @ GetStemmaRequest(_)                   => api.stemma(email, req)
      case req @ DeleteStemmaRequest(_)                => api.deleteStemma(email, req)
      case req @ UpdatePersonRequest(_, _, _)          => api.updatePerson(email, req)
      case req @ UpdateFamilyRequest(_, _, _)          => api.updateFamily(email, req)
      case req @ BearInvitationRequest(_)              => api.bearInvitation(email, req)
    }
  })
}
