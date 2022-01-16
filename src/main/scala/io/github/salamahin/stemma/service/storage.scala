package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.gremlin.GraphConfig
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{Has, UIO}

object storage {
  trait GraphStorage {
    def load(): UIO[ScalaGraph]
    def save(): UIO[Unit]
  }

  type STORAGE = Has[GraphStorage]

  private class GraphsonFile(file: String) extends GraphStorage {
    import gremlin.scala._

    private val graph = TinkerGraph.open(new GraphConfig).asScala()

    override def load(): UIO[ScalaGraph] = UIO {
      new GraphTraversalSource(graph.asJava())
        .io(file)
        .`with`(IO.reader, IO.graphson)
        .read()
        .iterate()

      graph
    }

    override def save(): UIO[Unit] = UIO {
      new GraphTraversalSource(graph.asJava())
        .io(file)
        .`with`(IO.reader, IO.graphson)
        .write()
        .iterate()
    }
  }

//  def graphsonFile(file: String): ULayer[GraphStorage] = ZLayer.succeed(new GraphsonFile(file))
}
