package io.github.salamahin.stemma

import io.github.salamahin.stemma.service.StorageService
import zio.{Scope, ZIO, ZIOAppDefault}

object SchemaCreator extends ZIOAppDefault {
  override def run: ZIO[Scope, Any, Any] =
    ZIO
      .service[StorageService]
      .flatMap(_.createSchema)
      .provideSome(StorageService.slick)
}
