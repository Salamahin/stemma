package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.response._
import io.github.salamahin.stemma.service.stemma.StemmaService
import io.github.salamahin.stemma.service.storage.localGraphsonFile
import io.github.salamahin.stemma.{IncompleteFamily, NoSuchFamilyId, StemmaError, request}
import zio.test.Assertion._
import zio.test._
import zio.{IO, UIO, ZIO}

object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val storageFromResouces = localGraphsonFile(getClass.getResource("/stemma.graphson").getFile)

  private val failOnWriteStemmaLayer = ZIO
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

  private val service = ZIO
    .environment[StemmaService]
    .map(_.get)
    .provideCustomLayer(graph.newGraph >>> (storageFromResouces >+> stemma.basic) >+> failOnWriteStemmaLayer >>> stemma.durable)

  private val revertChangesOnFailure = test("any change that modifies graph would be reverted on failure") {
    for {
      failingStemma  <- service
      _              <- failingStemma.newFamily(family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
      render(stemma) <- failingStemma.stemma()
    } yield assert(stemma)(hasSameElements("(Jane, John) parentsOf (Jake, Jill)" :: Nil))
  }

  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
}
