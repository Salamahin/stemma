package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.service.request.{NewChild, NewPerson, NewSpouse}
import io.github.salamahin.stemma.service.response.Stemma
import zio.stm.TReentrantLock
import zio.{Has, Task, ZManaged}

object repository {
  type Repository = Has[Service]

  trait Service {
    def newPerson(request: NewPerson): Task[String]
    def newChild(request: NewChild): Task[Unit]
    def newSpouse(request: NewSpouse): Task[Unit]
    def stemma: Task[Stemma]
  }

  def tinkerpop(path: String) = {
    ZManaged
      .fromAutoCloseable(Task(new TinkerpopRepository(path)))
      .map { repo =>
        new Service {
          private val locker = TReentrantLock.make

          override def newPerson(request: NewPerson): Task[String] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              id   = repo.newPerson(request)
            } yield id).commit

          override def newChild(request: NewChild): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.addChild(request)
            } yield ()).commit

          override def newSpouse(request: NewSpouse): Task[Unit] =
            (for {
              lock <- locker
              _    <- lock.acquireWrite
              _    = repo.addSpouse(request)
            } yield ()).commit

          override def stemma: Task[Stemma] =
            (for {
              lock   <- locker
              _      <- lock.acquireRead
              stemma = repo.stemma()
            } yield stemma).commit
        }
      }
      .toLayer
  }
}
