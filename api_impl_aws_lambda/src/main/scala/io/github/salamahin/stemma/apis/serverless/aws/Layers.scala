//package io.github.salamahin.stemma.apis.serverless.aws
//
//import gremlin.scala.ScalaGraph
//import io.github.salamahin.stemma.domain.{StemmaError, UnknownError}
//import io.github.salamahin.stemma.service._
//import org.apache.commons.configuration2.BaseConfiguration
//import org.umlg.sqlg.structure.SqlgGraph
//import org.umlg.sqlg.structure.ds.SqlgHikariDataSource
//import zio.Random.RandomLive
//import zio.{ZIO, ZLayer}
//
//object Layers {
//  @volatile private var gs: ScalaGraph = _
//  sys.addShutdownHook(() => { if (gs != null) gs.close() })
//
//  private val hookedGraphService: ZLayer[JdbcConfiguration, Throwable, GraphService] = ZLayer.fromZIO(
//    ZIO
//      .service[JdbcConfiguration]
//      .flatMap(conf => {
//        import gremlin.scala._
//        val config = new BaseConfiguration {
//          addPropertyDirect("jdbc.url", conf.jdbcUrl)
//          addPropertyDirect("jdbc.username", conf.jdbcUser)
//          addPropertyDirect("jdbc.password", conf.jdbcPassword)
//          addPropertyDirect("sqlg.dataSource", classOf[SqlgHikariDataSource].getCanonicalName)
//        }
//
//        ZIO.attempt(
//          new GraphService {
//            override val graph: ScalaGraph = {
//              val g: SqlgGraph = SqlgGraph.open(config)
//              val scalaG       = g.asScala()
//              gs = scalaG
//
//              scalaG
//            }
//          }
//        )
//      })
//  )
//
//  val layers: ZLayer[Any, StemmaError, StemmaService with UserService] =
//    (ZLayer.succeed(RandomLive) >+>
//      (InviteSecrets.fromEnv >+> JdbcConfiguration.fromEnv >+> hookedGraphService) >>>
//      (StemmaService.live ++ UserService.live)).mapError(exc => UnknownError(exc))
//}
