package io.github.salamahin.stemma

import zio._

import java.time.LocalDate

object repository {
  type Repository = Has[Service]
  final case class Stemma(kinsmenId: Int, familyId: Int, kinsmen: Map[Int, Kinsman], families: Map[Int, Family])

  trait Service {
    def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Task[Kinsman]
    def updateKinsman(id: Int, name: Option[String], birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Task[Unit]
    def kinsmen: Task[List[Kinsman]]

    def newFamily(parent1Id: Int, parent2Id: Option[Int], children: Seq[Int]): Task[Family]
    def updateFamily(id: Int, parent1Id: Option[Int], parent2Id: Option[Int], children: Seq[Int]): Task[Unit]
    def families: Task[List[Family]]
  }

  def live(init: Stemma): ZLayer[Any, Nothing, Has[Service]] = ZLayer.fromEffect(Ref.make(init).map(inMemory))

  private def inMemory(repository: Ref[Stemma]): Service = new Service {

    override def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): UIO[Kinsman] =
      repository
        .updateAndGet { stemma =>
          val newKinsmanId = stemma.kinsmenId + 1
          val newKinsman   = Kinsman(newKinsmanId, name, birthDate, deathDate)
          stemma.copy(kinsmen = stemma.kinsmen + (newKinsmanId -> newKinsman), kinsmenId = newKinsmanId)
        }
        .map(newStemma => newStemma.kinsmen(newStemma.kinsmenId))

    override def updateKinsman(id: Int, name: Option[String], birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Task[Unit] =
      repository.update { stemma =>
        val kinsman = stemma.kinsmen(id)

        kinsman.copy(
          name = name.getOrElse(kinsman.name),
          birthDate = birthDate,
          deathDate = deathDate
        )

        stemma.copy(kinsmen = stemma.kinsmen + (id -> kinsman))
      }.unit

    override def kinsmen: UIO[List[Kinsman]] =
      repository
        .get
        .map(_.kinsmen.values.toList)

    override def newFamily(parent1Id: Int, parent2Id: Option[Int], children: Seq[Int]): UIO[Family] =
      repository
        .updateAndGet { stemma =>
          val newFamilyId = stemma.familyId
          val newFamily   = Family(newFamilyId, parent1Id, parent2Id, children)
          stemma.copy(families = stemma.families + (newFamilyId -> newFamily), familyId = newFamilyId)
        }
        .map(newStemma => newStemma.families(newStemma.familyId))

    override def updateFamily(id: Int, parent1Id: Option[Int], parent2Id: Option[Int], children: Seq[Int]): Task[Unit] =
      repository.update { stemma =>
        val family = stemma.families(id)

        family.copy(
          parent1Id = parent1Id.getOrElse(family.parent1Id),
          parent2Id = parent2Id,
          childrenIds = children
        )

        stemma.copy(families = stemma.families + (id -> family))
      }.unit

    override def families: UIO[List[Family]] =
      repository
        .get
        .map(_.families.values.toList)
  }
}
