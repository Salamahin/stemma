package io.github.salamahin.stemma.apis.restful

import io.github.salamahin.stemma.service.StorageService
import org.postgresql.ds.PGSimpleDataSource
import zio.{Scope, ZIO, ZIOAppDefault}

import java.sql.Connection

object SchemaCreator extends ZIOAppDefault {
  override def run: ZIO[Scope, Any, Any] =
    ZIO
      .service[StorageService]
      .flatMap(_.createSchema)
      .provideSome(StorageService.slick)
}

object A extends App {
  val ds = new PGSimpleDataSource();
  ds.setUrl("jdbc:postgresql://free-tier13.aws-eu-central-1.cockroachlabs.cloud:26257/defaultdb?options=--cluster%3Dproud-gnoll-3170&sslmode=verify-full&sslrootcert=s3://stemma-app-junk-123/root.crt");
  ds.setUser("stemma-admin")
  ds.setPassword("VRB9irySLqaA4ncVE4baGQ")

  var conn: Connection = null;
  conn = ds.getConnection();
  val stat = conn.createStatement();
  val rs   = stat.executeQuery("SELECT 1");
}
