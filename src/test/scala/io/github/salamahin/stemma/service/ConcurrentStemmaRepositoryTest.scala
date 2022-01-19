package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.response._
import io.github.salamahin.stemma.service.stemma.StemmaService
import io.github.salamahin.stemma.service.storage.Storage
import io.github.salamahin.stemma.{NoSuchFamilyId, StemmaError, request}
import zio.test.environment.TestEnvironment
import zio.test.{DefaultRunnableSpec, ZSpec}
import zio.{IO, UIO, ZIO}

object ConcurrentStemmaRepositoryTest extends DefaultRunnableSpec {
//  private val storage = ZIO.access[GRAPH] { service =>
//    val graph = service.get.graph
//
//    new Storage {
//      override def save(): UIO[Unit] = UIO.succeed()
//
//      override def load(): UIO[Unit] = graph
//        .update { g =>
//          g
//        }
//    }
//  }

  private val stemma = new StemmaService {
    override def newFamily(family: request.FamilyDescription): IO[StemmaError, Family]                      = ???
    override def updateFamily(familyId: String, family: request.FamilyDescription): IO[StemmaError, Family] = ???
    override def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit]                                   = ???
    override def removePerson(id: String): IO[StemmaError, Unit]                                            = ???
    override def updatePerson(id: String, description: request.PersonDescription): IO[StemmaError, Unit]    = ???
    override def stemma(): UIO[Stemma]                                                                      = ???
  }

  override def spec: ZSpec[TestEnvironment, Any] = suite("checking thread saf")(???)
}
