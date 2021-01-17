package io.github.salamahin.stemma
import java.time.LocalDate

case class StoredData(kinsmanIdGenerator: Int, familyIdGenerator: Int, kinsmen: Seq[Kinsman], families: Seq[Family])

class InMemoryGateway(init: StoredData) extends Gateway {

  private var kinsmanIdGenerator = init.kinsmanIdGenerator
  private var familyIdGenerator  = init.familyIdGenerator

  private var kinsmanById = init
    .kinsmen
    .map(k => k.id -> k)
    .toMap

  private var familyById = init
    .families
    .map(f => f.id -> f)
    .toMap

  override def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Kinsman = {
    val newKinsmenId = kinsmanIdGenerator + 1
    val newKinsman   = Kinsman(newKinsmenId, name, birthDate, deathDate)

    kinsmanIdGenerator = newKinsmenId
    kinsmanById += (newKinsmenId -> newKinsman)

    newKinsman
  }

  override def kinsmen: Seq[Kinsman] = kinsmanById.values.toSeq

  override def updateKinsman(id: Int, name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): Unit = {
    val updatedKinsman = kinsmanById(id).copy(name = name, birthDate = birthDate, deathDate = deathDate)
    kinsmanById += id -> updatedKinsman
  }

  override def newFamily(parent1Id: Int, parent2Id: Option[Int], childrenIds: Seq[Int]): Family = {
    val newFamilyId = familyIdGenerator + 1
    val newFamily   = Family(newFamilyId, parent1Id, parent2Id, childrenIds)

    familyIdGenerator = newFamilyId
    familyById += (newFamilyId -> newFamily)

    newFamily
  }

  override def families: Seq[Family] = familyById.values.toSeq

  override def updateFamily(id: Int, parent1Id: Int, parent2Id: Option[Int], childrenIds: Seq[Int]): Unit = {
    val updatedFamily = familyById(id).copy(parent1Id = parent1Id, parent2Id = parent2Id, childrenIds = childrenIds)
    familyById += id -> updatedFamily
  }

  def state: StoredData = StoredData(kinsmanIdGenerator, familyIdGenerator, kinsmanById.values.toSeq, familyById.values.toSeq)
}
