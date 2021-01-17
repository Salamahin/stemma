package io.github.salamahin.stemma

import org.json4s.{DefaultFormats, Formats}
import org.scalatra._
import org.scalatra.json.JacksonJsonSupport
import org.scalatra.scalate.ScalateSupport

import java.time.LocalDate

class Controller(gw: Gateway) extends ScalatraServlet with JacksonJsonSupport with ScalateSupport with WebjarSupport {
  override protected implicit def jsonFormats: Formats = DefaultFormats

  before() {
    contentType = formats("json")
  }

  get("/kinsman") {
    gw.kinsmen
  }

  post("/kinsman") {
    val name      = params("name")
    val birthDate = params.get("birthDate").map(LocalDate.parse)
    val deathDate = params.get("deathDate").map(LocalDate.parse)

    gw.newKinsman(name, birthDate, deathDate)
  }

  put("/kinsman/:id") {
    val id        = params("id").toInt
    val name      = params("name")
    val birthDate = params.get("birthDate").map(LocalDate.parse)
    val deathDate = params.get("deathDate").map(LocalDate.parse)

    gw.updateKinsman(id, name, birthDate, deathDate)
  }

  get("/family") {
    gw.families
  }

  post("/family") {
    val parent1Id = params("parent1Id").toInt
    val parent2Id = params.get("parent2Id").map(_.toInt)
    val children  = multiParams.getOrElse("childrenIds", Nil).map(_.toInt)

    gw.newFamily(parent1Id, parent2Id, children)
  }

  put("/family/:id") {
    val id        = params("id").toInt
    val parent1Id = params("parent1Id").toInt
    val parent2Id = params.get("parent2Id").map(_.toInt)
    val children  = multiParams.getOrElse("childrenIds", Nil).map(_.toInt)

    gw.updateFamily(id, parent1Id, parent2Id, children)
  }

  get("/") {
    contentType = "text/html"
    ssp("/index")
  }
}
