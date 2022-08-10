package io.github.salamahin.stemma.service

import gremlin.scala.ScalaGraph
import org.apache.commons.configuration2.BaseConfiguration
import org.umlg.sqlg.SqlgPlugin
import org.umlg.sqlg.structure.SqlgGraph
import zio.{Scope, ZIO, ZLayer}

import java.util.ServiceLoader

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
                import scala.jdk.CollectionConverters._

                val clz = classOf[SqlgPlugin]
                println(clz)
                val claloader = clz.getClassLoader
                println(claloader)

                val loaded = ServiceLoader.load(classOf[SqlgPlugin], classOf[SqlgPlugin].getClassLoader).asScala.toList
                println(loaded)

                for (p <- loaded) {
                  println(p)
                }

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
