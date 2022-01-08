package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.StemmaRepository
import io.github.salamahin.stemma.gremlin.GremlinBasedStemmaRepository
import io.github.salamahin.stemma.request.{FamilyDescription, PersonDescription}
import io.github.salamahin.stemma.service.graph.{Graph, GraphService}
import io.github.salamahin.stemma.service.storage.{Storage, StorageService}
import zio._

object repository {
  type Repository = Has[PersistentStemmaService]

  class PersistentStemmaService(repo: StemmaRepository, persistence: StorageService) {
    def newFamily(family: FamilyDescription): UIO[String]                    = ???
    def updateFamily(familyId: String, family: FamilyDescription): UIO[Unit] = ???

    def removePerson(id: String): UIO[Unit]                                 = ???
    def updatePerson(id: String, description: PersonDescription): UIO[Unit] = ???
  }

  val live: ZLayer[Storage with Graph, Nothing, Repository] =
    ZLayer.fromServices[StorageService, GraphService, PersistentStemmaService]((persistence, graph) => new PersistentStemmaService(new GremlinBasedStemmaRepository(graph.graph), persistence))
}
