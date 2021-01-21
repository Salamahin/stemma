package io.github.salamahin.stemma

import io.circe.parser.decode
import zio._

import java.nio.file.{Files, Path}

object storage {
  type Storage = Has[Service]

  trait Service {
    def load: Task[Ref[Stemma]]
  }

  def fileBased(path: Path): ZLayer[Any, Throwable, Storage] = {
    import io.circe.generic.auto._
    import io.circe.syntax._

    import scala.jdk.CollectionConverters._

    def readFile = {
      val json   = Files.readAllLines(path).asScala.mkString("\n")
      val stemma = decode[Stemma](json)

      ZIO
        .fromEither(stemma)
        .flatMap(x => Ref.make(x))
    }

    def saveToFile(updatedStemma: Ref[Stemma]) = {
      for {
        stemma <- updatedStemma.get
        json   = stemma.asJson.toString()
      } yield Files.write(path, json.getBytes())
    }

    ZManaged
      .make(readFile)(saveToFile)
      .map(st =>
        new Service {
          override def load: Task[Ref[Stemma]] = Task.succeed(st)
        }
      )
      .toLayer
  }
}
