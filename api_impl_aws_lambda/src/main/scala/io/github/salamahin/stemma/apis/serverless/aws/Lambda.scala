package io.github.salamahin.stemma.apis.serverless.aws

import zio.json.JsonEncoder
import zio.{Exit, Runtime, Task, Unsafe}

trait Lambda {
  def runUnsafe[T: JsonEncoder](task: Task[T]) = {
    import zio.json._

    Unsafe.unsafe { implicit u => Runtime.default.unsafe.run(task) } match {
      case Exit.Success(value) => value.toJson
      case Exit.Failure(cause) => throw cause.squash
    }
  }
}
