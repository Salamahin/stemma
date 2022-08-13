//package io.github.salamahin.stemma.service
//
//import com.typesafe.scalalogging.LazyLogging
//import gremlin.scala.ScalaGraph
//import org.apache.commons.configuration2.BaseConfiguration
//import org.umlg.sqlg.structure.SqlgGraph
//import org.umlg.sqlg.structure.ds.SqlgHikariDataSource
//import zio.{Scope, ZIO, ZLayer}
//
//trait GraphService {
//  val graph: ScalaGraph
//}
//
//object GraphService extends LazyLogging {
//  def configure(jdbcConfiguration: JdbcConfiguration): ScalaGraph = {
//    logger.debug("Graph service init start")
//
//    val config = new BaseConfiguration {
//      addPropertyDirect("jdbc.url", jdbcConfiguration.jdbcUrl)
//      addPropertyDirect("jdbc.username", jdbcConfiguration.jdbcUser)
//      addPropertyDirect("jdbc.password", jdbcConfiguration.jdbcPassword)
//      addPropertyDirect("sqlg.dataSource", classOf[SqlgHikariDataSource].getCanonicalName)
//      addPropertyDirect("maximumPoolSize", 2)
//      addPropertyDirect("maxPoolSize", 3)
//    }
//
//    import gremlin.scala._
//    val g: SqlgGraph = SqlgGraph.open(config)
//    val scalaG       = g.asScala()
//
//    logger.debug("Graph service initiated")
//
//    scalaG
//  }
//
//  val scoped: ZLayer[JdbcConfiguration with Scope, Throwable, GraphService] = ZLayer.fromZIO(
//    for {
//      conf <- ZIO.service[JdbcConfiguration]
//      g    <- ZIO.acquireRelease(ZIO.attempt(configure(conf)))(g => ZIO.succeed(g.close()))
//    } yield new GraphService {
//      override val graph: ScalaGraph = g
//    }
//  )
//}
