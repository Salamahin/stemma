package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration.BaseConfiguration
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph
import zio.{UIO, ZLayer}

object storage {
  trait GraphStorage {
    def make(): UIO[ScalaGraph]
    def save(): UIO[Unit]
  }

  private class GraphsonFile(file: String) extends GraphStorage {
    import gremlin.scala._

    private val graph = {
      val config = new BaseConfiguration
      config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_EDGE_ID_MANAGER, "UUID")
      config.addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_VERTEX_ID_MANAGER, "UUID")
      TinkerGraph.open(config).asScala()
    }

    override def make(): UIO[ScalaGraph] = UIO {
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

  def graphsonFile(file: String) = ZLayer.succeed(new GraphsonFile(file))
}
