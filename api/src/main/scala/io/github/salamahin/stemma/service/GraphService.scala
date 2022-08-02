package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Scope, ZIO, ZLayer}

trait GraphService {
  val graph: ScalaGraph
}

object GraphService {
  val postgres: ZLayer[Secrets with Scope, Throwable, GraphService] = ZLayer(
    ZIO
      .service[Secrets]
      .map(_.postgresSecret)
      .flatMap(secret => {
        import gremlin.scala._
        val config = new BaseConfiguration {
          addPropertyDirect("jdbc.url", "jdbc:postgresql://localhost:5432/stemma")
          addPropertyDirect("jdbc.username", "postgres")
          addPropertyDirect("jdbc.password", secret)
        }

        ZIO.acquireRelease(
          ZIO.attempt(
            new GraphService {
              override val graph: ScalaGraph = {
                val g: SqlgGraph = SqlgGraph.open(config)
                g.asScala()
              }
            }
          )
        )(g => ZIO.succeed(g.graph.close()))
      })
  )
}
