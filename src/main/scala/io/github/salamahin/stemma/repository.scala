package io.github.salamahin.stemma

import io.github.salamahin.stemma.storage.Storage
import zio._

object repository {
  type Repository = Has[Service]

  trait Service {
    def kinsmen: Task[Map[Int, Kinsman]]
    def families: Task[Map[Int, Family]]
    def newKinsman(kinsman: Kinsman): Task[Int]
    def newFamily(family: Family): Task[Int]
  }

  def inMemory: ZLayer[Storage, Throwable, Repository] = ZLayer.fromEffect {
    ZIO
      .accessM[Storage](_.get.load)
      .map(repository =>
        new Service {
          override def kinsmen: UIO[Map[Int, Kinsman]] = repository.get.map(_.kinsmen)
          override def families: UIO[Map[Int, Family]] = repository.get.map(_.families)

          override def newKinsman(kinsman: Kinsman): UIO[Int] =
            repository
              .updateAndGet { stemma =>
                val newKinsmanId = stemma.kinsmenId + 1
                stemma.copy(kinsmen = stemma.kinsmen + (newKinsmanId -> kinsman), kinsmenId = newKinsmanId)
              }
              .map(newStemma => newStemma.kinsmenId)

          override def newFamily(family: Family): UIO[Int] =
            repository
              .updateAndGet { stemma =>
                val newFamilyId = stemma.familyId + 1
                stemma.copy(families = stemma.families + (newFamilyId -> family), familyId = newFamilyId)
              }
              .map(newStemma => newStemma.familyId)
        }
      )
  }
}
