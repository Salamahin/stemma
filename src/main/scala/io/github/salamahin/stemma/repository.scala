package io.github.salamahin.stemma

import io.circe.parser.decode
import zio._

import java.nio.file.{Files, Path}
import java.time.LocalDate

//final case class StoredStemma(kinsmenIdGenerator: Int, relationIdGenerator: Int, stemma: Stemma) {
//  def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]) = {
//    val nextCountId = kinsmenIdGenerator + 1
//    val nextId      = s"k$nextCountId"
//
//    copy(
//      kinsmenIdGenerator = nextCountId,
//      kinsmen = Kinsman(nextId, name, birthDate, deathDate) :: kinsmen
//    )
//  }
//
//  def relateParent(parent1Id: String, childId: String) = {
//
//  }
//}

object repository {
  type Repository = Has[Service]

  trait Service {
//    def kinsmen: Task[Map[Int, Kinsman]]
//    def families: Task[Map[Int, Family]]
//    def newKinsman(kinsman: Kinsman): Task[Int]
//    def newFamily(family: Family): Task[Int]
  }

//  private def inMemoryService(repository: Ref[Stemma]): Service = new Service {
//    override def kinsmen: UIO[Map[Int, Kinsman]] = repository.get.map(_.kinsmen)
//    override def families: UIO[Map[Int, Family]] = repository.get.map(_.families)
//
//    override def newKinsman(name: String, birthDate: Option[LocalDate], deathDate: Option[LocalDate]): UIO[Int] =
//      repository
//        .updateAndGet { stemma =>
//          val newKinsmanId = stemma.kinsmenIdGenerator + 1
//          stemma.copy(kinsmen = stemma.kinsmen + (newKinsmanId -> kinsman), kinsmenIdGenerator = newKinsmanId)
//        }
//        .map(newStemma => newStemma.kinsmenIdGenerator)
//
//    override def newFamily(family: Family): UIO[Int] =
//      repository
//        .updateAndGet { stemma =>
//          val newFamilyId = stemma.relationIdGenerator + 1
//          stemma.copy(families = stemma.families + (newFamilyId -> family), relationIdGenerator = newFamilyId)
//        }
//        .map(newStemma => newStemma.relationIdGenerator)
//  }
//
//  def fileBased(path: Path) = {
//    import io.circe.generic.auto._
//    import io.circe.syntax._
//    import zio.duration._
//
//    import scala.jdk.CollectionConverters._
//
//    def readFile = {
//      val json   = Files.readAllLines(path).asScala.mkString("\n")
//      val stemma = decode[Stemma](json)
//
//      ZIO
//        .fromEither(stemma)
//        .flatMap(x => Ref.make(x))
//    }
//
//    def saveState(updatedStemma: Ref[Stemma]) = {
//      for {
//        stemma <- updatedStemma.get
//        json   = stemma.asJson.toString()
//      } yield Files.write(path, json.getBytes())
//    }
//
//    def periodicalFlush(updatedStemma: Ref[Stemma]) =
//      saveState(updatedStemma)
//        .delay(1.minute)
//        .repeat(Schedule.spaced(10.second))
//
//    ZManaged
//      .make(readFile)(saveState)
//      .flatMap { stemma =>
//        val saveInBackground = periodicalFlush(stemma).forkDaemon
//        val createService    = UIO(inMemoryService(stemma))
//
//        (saveInBackground *> createService).toManaged_
//      }
//      .toLayer
//  }

  def fileBased(path: Path): ZLayer[Any, Nothing, Repository] = ???
}
