package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.graph.Graph
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import zio.{Has, UIO, ZIO, ZLayer}

object storage {
  trait Storage {
    def save(): UIO[Unit]
    def load(): UIO[Unit]
  }

  type STORAGE = Has[Storage]

  private class GraphsonFile(file: String, graph: ScalaGraph) extends Storage {
    import gremlin.scala._
    override def load() = UIO {
      new GraphTraversalSource(graph.asJava())
        .io(file)
        .`with`(IO.reader, IO.graphson)
        .read()
        .iterate()
    }

    override def save(): UIO[Unit] = UIO {
      new GraphTraversalSource(graph.asJava())
        .io(file)
        .`with`(IO.reader, IO.graphson)
        .write()
        .iterate()
    }
  }

  def localGraphsonFile(file: String): ZLayer[Graph, Nothing, STORAGE] =
    ZIO.access[Graph](gr => new GraphsonFile(file, gr.graph)).toLayer
}
