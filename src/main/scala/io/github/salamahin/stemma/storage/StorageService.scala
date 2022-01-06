package io.github.salamahin.stemma.storage

import io.github.salamahin.stemma.storage.GraphService.Graph
import org.apache.tinkerpop.gremlin.process.traversal.IO
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource
import zio.{Has, UIO, ZLayer}

trait StorageService {
  def load(): UIO[Unit]
  def persist(): UIO[Unit]
}

object StorageService {
  type Storage = Has[StorageService]

  def localGraphsonFile(file: String): ZLayer[Graph, Nothing, Storage] =
    ZLayer.fromService[GraphService, StorageService](graphService =>
      new StorageService {
        import gremlin.scala._

        override def load(): UIO[Unit] = UIO {
          new GraphTraversalSource(graphService.graph.asJava())
            .io(file)
            .`with`(IO.reader, IO.graphson)
            .read()
            .iterate()
        }

        override def persist(): UIO[Unit] = UIO {
          new GraphTraversalSource(graphService.graph.asJava())
            .io(file)
            .`with`(IO.reader, IO.graphson)
            .write()
            .iterate()
        }
      }
    )
}
