package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{URLayer, ZIO}

trait GraphService {
  val graph: ScalaGraph
}

object GraphService {
  val postgres: URLayer[Secrets, GraphService] = ZIO
    .environment[Secrets]
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
