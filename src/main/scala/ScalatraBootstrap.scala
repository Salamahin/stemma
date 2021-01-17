import io.github.salamahin.stemma._
import org.scalatra._

import java.nio.file.{Files, Paths}
import javax.servlet.ServletContext
import scala.io.Source
import scala.util.Using

class ScalatraBootstrap extends LifeCycle {
  import org.json4s._
  import org.json4s.jackson.JsonMethods._
  private implicit lazy val jsonFormats: Formats = DefaultFormats

  private val stateFile           = "state.json"
  private var gw: InMemoryGateway = _

  override def init(context: ServletContext) {
    val lines = Using(Source.fromFile(stateFile))(_.mkString("\n")).get
    val state = parse(lines).extractOpt[StoredData].getOrElse(StoredData(0, 0, Nil, Nil))
    gw = new InMemoryGateway(state)
    context.mount(new Controller(gw), "/*")
  }

  override def destroy(context: ServletContext): Unit = {
    val json = pretty(render(Extraction.decompose(gw.state)))
    Files.write(Paths.get(stateFile), json.getBytes)
  }
}
