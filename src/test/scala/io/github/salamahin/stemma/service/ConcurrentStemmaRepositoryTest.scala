package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.response.Family
import io.github.salamahin.stemma.service.stemma.{STEMMA, StemmaService}
import zio.test.Assertion.hasSameElements
import zio.test.{DefaultRunnableSpec, assert}
import zio.{IO, ZIO, ZManaged}

import java.io.{File, FileOutputStream}
import java.nio.file.{Files, Paths}
import scala.util.Using

object ConcurrentStemmaRepositoryTest extends DefaultRunnableSpec with Requests with RenderStemma {
  private def copyToTempFile(resource: String) = {
    val tempFile     = File.createTempFile("stemma-test-", ".graphson")
    val resourceFile = Paths.get(getClass.getResource(resource).getPath)

    Using(new FileOutputStream(tempFile)) { os => Files.copy(resourceFile, os) }

    tempFile
  }

  private val localStemmaStorage = ZManaged
    .make(IO(copyToTempFile("/stemma.graphson"))) { file => IO(file.delete()).fold(_ => (), _ => ()) }
    .map(_.getPath)
    .toLayer
    .flatMap(path => storage.localGraphsonFile(path.get))

  private val dependencies = graph.newGraph >>> (localStemmaStorage ++ stemma.basic) >>> stemma.durable
  private val service      = ZIO.environment[STEMMA].map(_.get).provideCustomLayer(dependencies)

  private def createAndCleanFamily(stemma: StemmaService) =
    for {
      Family(fid, parents, children) <- stemma.newFamily(family(createJane, createJohn)(createJill, createJuly))
      _                              <- stemma.removeFamily(fid)
      _                              <- ZIO.foreachPar_(parents ++ children)(stemma.removePerson)
    } yield ()

  private val concurrentAccessTest = testM("service is thread safe")(for {
    s              <- service
    _              <- ZIO.foreachPar_(List.fill(500)(s))(createAndCleanFamily)
    render(stemma) <- s.stemma()
  } yield assert(stemma)(hasSameElements("(Jane, John) parentsOf (Jake, Jill)" :: Nil)))

  override def spec = suite("StemmaService: thread safety")(concurrentAccessTest)
}
