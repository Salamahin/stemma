package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.response.Stemma
import io.github.salamahin.stemma.storage.GraphService.Graph
import io.github.salamahin.stemma.storage.StorageService.Storage
import zio._

import java.util.UUID

trait StemmaService {
  def newPerson(request: PersonRequest): Task[UUID]
  def removePerson(uuid: UUID): Task[Unit]
  def updatePerson(uuid: UUID, request: PersonRequest): Task[Unit]
  def newFamily(request: FamilyRequest): Task[UUID]
  def stemma(): Task[Stemma]
}

trait CommitChanges extends StemmaService {
  val persistence: StorageService

  abstract override def newPerson(request: PersonRequest): Task[UUID]                = super.newPerson(request) <* persistence.persist()
  abstract override def removePerson(uuid: UUID): Task[Unit]                         = super.removePerson(uuid) <* persistence.persist()
  abstract override def updatePerson(uuid: UUID, request: PersonRequest): Task[Unit] = super.updatePerson(uuid, request) <* persistence.persist()
  abstract override def newFamily(request: FamilyRequest): Task[UUID]                = super.newFamily(request) <* persistence.persist()
}

object StemmaService {
  type Repository = Has[StemmaService]

  val live: ZLayer[Storage with Graph, Nothing, Repository] =
    ZLayer.fromServices[StorageService, GraphService, StemmaService]((persistenceService, graphService) =>
      new GremlinBasedStemmaService(graphService.graph) with CommitChanges {
        override val persistence: StorageService = persistenceService
      }
    )
}
