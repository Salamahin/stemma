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