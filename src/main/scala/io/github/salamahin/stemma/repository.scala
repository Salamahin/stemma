package io.github.salamahin.stemma

import zio._

import java.time.LocalDate

final case class Kinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate])
final case class Family(parent1Id: Int, parent2Id: Option[Int], childrenIds: Seq[Int])
final case class Stemma(kinsmenId: Int, familyId: Int, kinsmen: Map[Int, Kinsman], families: Map[Int, Family])

object repository {
  type Repository = Has[Service]

  trait Service {
    def newKinsman(kinsman: Kinsman): Task[Int]
    def kinsmen: Task[Map[Int, Kinsman]]

    def newFamily(family: Family): Task[Int]
    def families: Task[Map[Int, Family]]
  }

  def inMemory(init: Stemma): ZLayer[Any, Nothing, Has[Service]] = ZLayer.fromEffect {
    Ref
      .make(init)
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
                val newFamilyId = stemma.familyId
                stemma.copy(families = stemma.families + (newFamilyId -> family), familyId = newFamilyId)
              }
              .map(newStemma => newStemma.familyId)
        }
      )
  }
}
