package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import io.github.salamahin.stemma.service.SecretService.SECRET
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Has, URLayer, ZIO}

object GraphService {
  trait GraphService {
    val graph: ScalaGraph
  }

  type GRAPH = Has[GraphService]

  val postgres: URLayer[SECRET, GRAPH] = ZIO
    .environment[SECRET]
    .map(_.get)
    .map(_.postgresSecret)
    .map(secret => {
      import gremlin.scala._
      val config = new BaseConfiguration {
        addPropertyDirect("jdbc.url", "jdbc:postgresql://localhost:5432/stemma")
        addPropertyDirect("jdbc.username", "postgres")
        addPropertyDirect("jdbc.password", secret)
      }

      new GraphService {
        override val graph: ScalaGraph = {
          val g: SqlgGraph = SqlgGraph.open(config)
          g.asScala()
        }
      }
    })
    .toLayer
}
