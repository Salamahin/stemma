package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.service.graph.GRAPH
import io.github.salamahin.stemma.tinkerpop.GraphConfig
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Has, Ref, UIO, URLayer, ZIO}

object storage {
  trait Storage {
    def save(): UIO[Unit]
    def load(): UIO[Unit]
  }

  type STORAGE = Has[Storage]

  import gremlin.scala._
  private class GraphsonFile(file: String, graph: Ref[ScalaGraph]) extends Storage {
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

  def localGraphsonFile(file: String): URLayer[GRAPH, STORAGE] = ZIO.access[GRAPH](g => new GraphsonFile(file, g.get.graph)).toLayer
}
