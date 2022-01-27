package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.Family
import io.github.salamahin.stemma.service.stemma.{STEMMA, StemmaService}
import zio.ZIO
import zio.test.Assertion.hasSameElements
import zio.test.{DefaultRunnableSpec, assert}

object ConcurrentStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private val service = ZIO
    .environment[STEMMA]
    .map(_.get)
    .provideCustomLayer(TempGraphService.make >>> repo.live >>> stemma.live)

  private def createAndCleanFamily(stemma: StemmaService) =
    for {
      Family(fid, parents, children) <- stemma.newFamily(family(createJane, createJohn)(createJill, createJuly))
      _                              <- stemma.removeFamily(fid)
      _                              <- ZIO.foreachPar_(parents ++ children)(stemma.removePerson)
    } yield ()

  private val concurrentAccessTest = testM("service is thread safe")(for {
    s              <- service
    _              <- createAndCleanFamily(s)
    _              <- ZIO.foreachPar_(List.fill(10)(s))(createAndCleanFamily)
    render(stemma) <- s.stemma()
  } yield assert(stemma)(hasSameElements("(Jane, John) parentsOf (Jake, Jill)" :: Nil)))

  override def spec = suite("StemmaService: thread safety")(concurrentAccessTest)
}
