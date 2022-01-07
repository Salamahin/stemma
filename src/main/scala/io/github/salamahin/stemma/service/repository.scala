package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.gremlin.GremlinBasedStemmaRepository
import io.github.salamahin.stemma.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.response.Stemma
import io.github.salamahin.stemma.service.graph.{Graph, GraphService}
import io.github.salamahin.stemma.service.storage.{Storage, StorageService}
import io.github.salamahin.stemma.{NoSuchPersonId, StemmaRepository}
import zio._

object repository {
  type Repository = Has[PersistentStemmaService]

  class PersistentStemmaService(repo: StemmaRepository, persistence: StorageService) {
    persistence.load()

    def newPerson(request: PersonRequest): UIO[String]                             = UIO(repo.newPerson(request)) <* persistence.persist()
    def removePerson(id: String): IO[NoSuchPersonId, Unit]                         = IO.fromEither(repo.removePerson(id)) <* persistence.persist()
    def updatePerson(id: String, request: PersonRequest): IO[NoSuchPersonId, Unit] = IO.fromEither(repo.updatePerson(id, request)) <* persistence.persist()
    def newFamily(request: FamilyRequest): UIO[String]                             = ???
    def stemma(): UIO[Stemma]                                                      = UIO(repo.stemma())
  }

  val live: ZLayer[Storage with Graph, Nothing, Repository] =
    ZLayer.fromServices[StorageService, GraphService, PersistentStemmaService]((persistence, graph) => new PersistentStemmaService(new GremlinBasedStemmaRepository(graph.graph), persistence))
}
