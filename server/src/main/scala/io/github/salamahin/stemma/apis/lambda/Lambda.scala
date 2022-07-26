package io.github.salamahin.stemma.apis.lambda

import zio.Task
import zio.lambda.{Context, ZLambda}

object Lambda extends ZLambda[String, String]{
  override def apply(event: String, context: Context): Task[String] = ???
}
