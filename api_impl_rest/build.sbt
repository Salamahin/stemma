libraryDependencies ++= Seq(
  "io.d11"                 %% "zhttp"                  % "2.0.0-RC9",
  "com.google.api-client"  % "google-api-client"       % "1.35.1",
  "com.google.http-client" % "google-http-client-gson" % "1.42.0"
)

assembly / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case x                             => MergeStrategy.last
}

enablePlugins(JavaAppPackaging)

assembly / assemblyJarName := "stemma-restful-standalone.jar"

Linux / packageSummary := "Stemma RESTful backend API implemenation"
Universal / mappings := {
  val universalMappings = (Universal / mappings).value
  val fatJar            = (Compile / assembly).value
  val filtered = universalMappings filter {
    case (file, name) => !name.endsWith(".jar")
  }
  filtered :+ (fatJar -> ("lib/" + fatJar.getName))
}
scriptClasspath := Seq((assembly / assemblyJarName).value)
dockerExposedPorts := Seq(8090)
Docker / packageName := "stemma-restful-standalone"
Docker / version := version.value
