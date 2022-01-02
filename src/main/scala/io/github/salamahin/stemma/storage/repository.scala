package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.service.request.{FamilyRequest, PersonRequest}
import io.github.salamahin.stemma.service.response.Stemma
import zio.stm.TReentrantLock
import zio.{Has, Task, ZManaged}

import java.util.UUID

object repository {
  type Repository = Has[Service]

  trait Service {
    def newPerson(request: PersonRequest): Task[String]
    def updatePerson(uuid: UUID, request: PersonRequest): Task[Unit]
    def removePerson(uuid: UUID): Task[Unit]
    def mergePerson(oldUUID: UUID, newUUID: UUID): Task[Unit]
    def newFamily(request: FamilyRequest): Task[Unit]
    def stemma: Task[Stemma]
  }

  def tinkerpop(path: String) = {
    ZManaged
      .fromAutoCloseable(Task(new TinkerpopRepository(path)))
      .map { repo =>
        new Service {
          private val locker = TReentrantLock.make

          override def newPerson(request: PersonRequest): Task[String] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              id   = repo.newPerson(request)
            } yield id).commit

          override def newFamily(request: FamilyRequest): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.addFamily(request)
            } yield ()).commit

          override def stemma: Task[Stemma] =
            (for {
              lock   <- locker
              _      <- lock.acquireRead
              stemma = repo.stemma()
            } yield stemma).commit

          override def updatePerson(uuid: UUID, request: PersonRequest): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.updatePerson(uuid, request)
            } yield ()).commit

          override def removePerson(uuid: UUID): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.removePerson(uuid)
            } yield ()).commit

          override def mergePerson(oldUUID: UUID, newUUID: UUID): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.merge(oldUUID, newUUID)
            } yield ()).commit
        }
      }
      .toLayer
  }
}
