package io.github.salamahin.stemma

import org.fusesource.scalate.util.IOUtil
import org.scalatra.ScalatraServlet

trait WebjarSupport {
  self: ScalatraServlet =>

  get("/webjars/*") {
    val resourcePath = "/META-INF/resources/webjars/" + params("splat")
    Option(getClass.getResourceAsStream(resourcePath)) match {
      case Some(inputStream) =>
        contentType = servletContext.getMimeType(resourcePath)
        IOUtil.loadBytes(inputStream)

      case None => resourceNotFound()
    }
  }
}
