package io.github.salamahin.stemma.apis.serverless.aws

import com.typesafe.config.{Config, ConfigFactory}
import com.typesafe.scalalogging.LazyLogging
import io.github.salamahin.stemma.apis.serverless.aws.StemmaLambda.layers
import io.github.salamahin.stemma.apis.{ApiService, HandleApiRequestService}
import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.{InviteSecrets, StorageService, UserService}
import slick.interop.zio.DatabaseProvider
import slick.jdbc._
import zio.Random.RandomLive
import zio.{FiberRef, FiberRefs, IO, RuntimeFlags, Scope, UIO, ZEnvironment, ZIO, ZLayer}

import java.nio.file.{Files, Paths}
import java.util.Base64
import scala.util.Try


