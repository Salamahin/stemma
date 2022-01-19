package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.response._
import io.github.salamahin.stemma.service.graph.Graph
import io.github.salamahin.stemma.service.stemma.StemmaService
import io.github.salamahin.stemma.service.storage.Storage
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import io.github.salamahin.stemma.{NoSuchFamilyId, StemmaError, request, response}
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.test.environment.TestEnvironment
import zio.test.{DefaultRunnableSpec, ZSpec}
import zio.{IO, Ref, UIO, ZIO}

object ConcurrentStemmaRepositoryTest extends DefaultRunnableSpec {
  private val graphState = Ref.make {
    import gremlin.scala._
    TinkerGraph.open(new GraphConfig).asScala()
  }
    .map(g => new Graph {
      override val graph: ScalaGraph = g
    })

  private val storage = new Storage {
    override def save(): UIO[Unit] = ???
    override def load(): UIO[Unit] = ???
  }

  private val stemma = new StemmaService {
    override def newFamily(family: request.FamilyDescription): IO[StemmaError, Family]                      = ???
    override def updateFamily(familyId: String, family: request.FamilyDescription): IO[StemmaError, Family] = ???
    override def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit]                                            = ???
    override def removePerson(id: String): IO[StemmaError, Unit]                                                     = ???
    override def updatePerson(id: String, description: request.PersonDescription): IO[StemmaError, Unit]             = ???
    override def stemma(): UIO[Stemma]                                                                      = ???
  }

  override def spec: ZSpec[TestEnvironment, Any] = suite("checking thread saf")
}
