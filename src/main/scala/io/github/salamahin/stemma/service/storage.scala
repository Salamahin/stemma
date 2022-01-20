package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.service.graph.GraphService
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Ref, UIO, URLayer, ZIO}

object storage {
  trait StorageService {
    def save(): UIO[Unit]
    def load(): UIO[Unit]
  }

  import gremlin.scala._
  private class GraphsonFile(file: String, graph: Ref[ScalaGraph]) extends StorageService {
    override def load(): UIO[Unit] =
      graph.set {
        val graph = TinkerGraph.open(new GraphConfig).asScala()

        new GraphTraversalSource(graph.asJava())
          .io(file)
          .`with`(IO.reader, IO.graphson)
          .read()
          .iterate()

        graph
      }

    override def save(): UIO[Unit] = graph.get.map { g =>
      new GraphTraversalSource(g.asJava())
        .io(file)
        .`with`(IO.reader, IO.graphson)
        .write()
        .iterate()
    }
  }

  def localGraphsonFile(file: String): URLayer[GraphService, StorageService] = ZIO.environmentWith[GraphService](g => new GraphsonFile(file, g.get.graph)).toLayer
}
