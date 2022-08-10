package io.github.salamahin.stemma.apis.serverless.aws

import com.google.common.base.Throwables
import com.typesafe.scalalogging.LazyLogging
import zio.json.JsonEncoder
import zio.{Exit, Runtime, Task, Unsafe}

trait Lambda extends LazyLogging {
  def runUnsafe[T: JsonEncoder](task: Task[T]) = {
    import zio.json._

    Unsafe.unsafe { implicit u => Runtime.default.unsafe.run(task) } match {
      case Exit.Success(value) => value.toJson
      case Exit.Failure(cause) =>
        logger.error(s"Unexpected error: ${Throwables.getStackTraceAsString(cause.squash)}")
        throw new IllegalStateException(cause.squash)
    }
  }
}
