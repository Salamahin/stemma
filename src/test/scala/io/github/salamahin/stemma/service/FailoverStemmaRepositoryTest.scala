package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.response._
import io.github.salamahin.stemma.service.stemma.StemmaService
import io.github.salamahin.stemma.service.storage.StorageService
import io.github.salamahin.stemma.{IncompleteFamily, NoSuchFamilyId, StemmaError, request}
import zio.test.{DefaultRunnableSpec, TestEnvironment, ZSpec}
import zio.{IO, Ref, UIO, ZEnv, ZIO, ZIOAppArgs, ZIOAppDefault, ZLayer}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests {

  private val storage = new StorageService {
    val stemmaRef = Ref.make(
      Stemma(
        Person("1", "jake", None, None) ::
          Person("2", "jane", None, None) ::
          Person("3", "john", None, None) ::
          Nil,
        Family("1", "2" :: Nil, "2" :: "3" :: Nil) :: Nil
      )
    )

    override def save(): UIO[Unit] = ???
    override def load(): UIO[Unit] = ???
  }

  private val failOnWriteStemmaService = ZIO
    .environment[StemmaService]
    .map { underlying =>
      val service = underlying.get

      new StemmaService {
        override def newFamily(family: request.FamilyDescription): IO[StemmaError, Family]                      = service.newFamily(family) <* ZIO.fail(IncompleteFamily())
        override def updateFamily(familyId: String, family: request.FamilyDescription): IO[StemmaError, Family] = service.updateFamily(familyId, family) <* ZIO.fail(IncompleteFamily())
        override def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit]                                   = service.removeFamily(familyId) <* ZIO.fail(NoSuchFamilyId(familyId))
        override def removePerson(id: String): IO[StemmaError, Unit]                                            = service.removePerson(id) <* ZIO.fail(IncompleteFamily())
        override def updatePerson(id: String, description: request.PersonDescription): IO[StemmaError, Unit]    = service.updatePerson(id, description) <* ZIO.fail(IncompleteFamily())
        override def stemma(): UIO[Stemma]                                                                      = service.stemma()
      }
    }
    .toLayer

  override def spec: ZSpec[TestEnvironment, Any] = ???
}

object Aa extends ZIOAppDefault with Requests {
  val depts = (graph.newGraph >>> (storage.localGraphsonFile("test.graphson") >+> stemma.basic)) >>> stemma.durable

  override def run: ZIO[ZEnv with ZIOAppArgs, Any, Any] =
    (for {
      stemma <- ZIO.environment[StemmaService].map(_.get)
      _ <- stemma.newFamily(family(createJohn, createJane)(createJake, createJill))
    } yield ()).provideCustomLayer(depts)
}
