//package io.github.salamahin.stemma.service
//
//import io.github.salamahin.stemma.domain._
//import io.github.salamahin.stemma.service.stemma.{STEMMA, StemmaService}
//import io.github.salamahin.stemma.service.storage.localGraphsonFile
//import zio.test.Assertion._
//import zio.test._
//import zio.{IO, UIO, ZIO}
//
//object FailoverStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
//  private val storageFromResouces = localGraphsonFile(getClass.getResource("/stemma.graphson").getFile)
//
//  private val failOnWriteStemmaLayer = ZIO
//    .environment[STEMMA]
//    .map { underlying =>
//      val service = underlying.get
//
//      new StemmaService {
//        override def newFamily(family: FamilyDescription): IO[StemmaError, Family]                    = service.newFamily(family) <* ZIO.fail(IncompleteFamily())
//        override def updateFamily(familyId: Long, family: FamilyDescription): IO[StemmaError, Family] = service.updateFamily(familyId, family) <* ZIO.fail(IncompleteFamily())
//        override def removeFamily(familyId: Long): IO[NoSuchFamilyId, Unit]                           = service.removeFamily(familyId) <* ZIO.fail(NoSuchFamilyId(familyId))
//        override def removePerson(id: Long): IO[StemmaError, Unit]                                    = service.removePerson(id) <* ZIO.fail(IncompleteFamily())
//        override def updatePerson(id: Long, description: PersonDescription): IO[StemmaError, Unit]    = service.updatePerson(id, description) <* ZIO.fail(IncompleteFamily())
//        override def stemma(): UIO[Stemma]                                                            = service.stemma()
//      }
//    }
//    .toLayer
//
//  private val service = ZIO
//    .environment[STEMMA]
//    .map(_.get)
//    .provideCustomLayer((InMemoryGraphService.create >+> repo.repo) >>> (storageFromResouces ++ stemma.basic) >+> failOnWriteStemmaLayer >>> stemma.durable)
//
//  private val revertChangesOnFailure = testM("any change that modifies graph would be reverted on failure") {
//    for {
//      failingStemma  <- service
//      _              <- failingStemma.newFamily(family(createJames, createJuly)()).catchAll(_ => ZIO.succeed())
//      render(stemma) <- failingStemma.stemma()
//    } yield assert(stemma)(hasSameElements("(Jane, John) parentsOf (Jake, Jill)" :: Nil))
//  }
//
//  override def spec = suite("StemmaService: corruption")(revertChangesOnFailure)
//}
