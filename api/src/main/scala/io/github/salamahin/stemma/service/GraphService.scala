package io.github.salamahin.stemma.service

import com.typesafe.scalalogging.LazyLogging
import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.structure.SqlgGraph
import org.umlg.sqlg.structure.ds.SqlgHikariDataSource
import zio.{Scope, ZIO, ZLayer}

trait GraphService {
  val graph: ScalaGraph
}

object GraphService extends LazyLogging {
  val postgres: ZLayer[JdbcConfiguration with Scope, Throwable, GraphService] = ZLayer(
    ZIO
      .service[JdbcConfiguration]
      .flatMap(conf => {
        import gremlin.scala._
        val config = new BaseConfiguration {
          addPropertyDirect("jdbc.url", conf.jdbcUrl)
          addPropertyDirect("jdbc.username", conf.jdbcUser)
          addPropertyDirect("jdbc.password", conf.jdbcPassword)
          addPropertyDirect("sqlg.dataSource", classOf[SqlgHikariDataSource].getCanonicalName)
        }

        ZIO.acquireRelease(
          ZIO.attempt(
            new GraphService {
              override val graph: ScalaGraph = {
                logger.debug("Graph service init start")
                val g: SqlgGraph = SqlgGraph.open(config)
                val scalaG       = g.asScala()
                logger.debug("Graph service initiated")
                scalaG
              }
            }
          )
        )(g => ZIO.succeed(g.graph.close()))
      })
  )
}
