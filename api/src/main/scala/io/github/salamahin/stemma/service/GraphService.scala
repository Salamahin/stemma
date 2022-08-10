package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Scope, ZIO, ZLayer}

trait GraphService {
  val graph: ScalaGraph
}

object GraphService {
  val postgres: ZLayer[JdbcConfiguration with Scope, Throwable, GraphService] = ZLayer(
    ZIO
      .service[JdbcConfiguration]
      .flatMap(conf => {
        import gremlin.scala._
        val config = new BaseConfiguration {
          addPropertyDirect("jdbc.url", conf.jdbcUrl)
          addPropertyDirect("jdbc.username", conf.jdbcUser)
          addPropertyDirect("jdbc.password", conf.jdbcPassword)
        }

        ZIO.acquireRelease(
          ZIO.attempt(
            new GraphService {
              override val graph: ScalaGraph = {
                Class.forName("org.postgresql.Driver")
                Class.forName("org.umlg.sqlg.PostgresPlugin")

                val g: SqlgGraph = SqlgGraph.open(config)
                g.asScala()
              }
            }
          )
        )(g => ZIO.succeed(g.graph.close()))
      })
  )
}
