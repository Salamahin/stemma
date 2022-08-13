//package io.github.salamahin.stemma.apis.serverless.aws
//
//import io.github.salamahin.stemma.apis.API
//import io.github.salamahin.stemma.domain._
//import zio.{Task, ZIO}
//
//class StemmaLambda extends Lambda[Request, Response] {
//  override def run(email: String, request: Request): ZIO[Any, StemmaError, Response] =
//    (request match {
//      case ListStemmasRequest()                     => API.listStemmas(email)
//      case req @ CreateFamilyRequest(_, _)          => API.createFamily(email, req)
//      case req @ CreateInvitationTokenRequest(_, _) => API.createInvitationToken(email, req)
//      case req @ CreateNewStemmaRequest(_)          => API.createNewStemma(email, req)
//      case req @ DeleteFamilyRequest(_, _)          => API.deleteFamily(email, req)
//      case req @ DeletePersonRequest(_, _)          => API.deletePerson(email, req)
//      case req @ GetStemmaRequest(_)                => API.stemma(email, req)
//      case req @ DeleteStemmaRequest(_)             => API.deleteStemma(email, req)
//      case req @ UpdatePersonRequest(_, _, _)       => API.updatePerson(email, req)
//      case req @ UpdateFamilyRequest(_, _, _)       => API.updateFamily(email, req)
//      case req @ BearInvitationRequest(_)           => API.bearInvitation(email, req)
//    }).provideLayer(Layers.layers)
//}
