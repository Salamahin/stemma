lazy val versions = new {
  val circeV = "0.14.2"
  val zioV   = "2.0.0-RC6"
  val sqlgV  = "2.1.6"
}

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
scalacOptions ++= Seq("-deprecation", "-feature", "-Ylog-classpath")

libraryDependencies ++= Seq(
  "dev.zio"                    %% "zio"                    % versions.zioV,
  "dev.zio"                    %% "zio-test"               % versions.zioV % Test,
  "dev.zio"                    %% "zio-test-sbt"           % versions.zioV % Test,
  "dev.zio"                    %% "zio-lambda"             % "1.0.0-RC5",
  "io.d11"                     %% "zhttp"                  % "2.0.0-RC9",
  "io.circe"                   %% "circe-parser"           % versions.circeV,
  "io.circe"                   %% "circe-generic-extras"   % versions.circeV,
  "com.michaelpollmeier"       %% "gremlin-scala"          % "3.5.3.2",
  "org.umlg"                   % "sqlg-core"               % versions.sqlgV,
  "org.umlg"                   % "sqlg-postgres-dialect"   % versions.sqlgV,
  "org.umlg"                   % "sqlg-hikari"             % versions.sqlgV,
  "ch.qos.logback"             % "logback-classic"         % "1.3.0-alpha16",
  "com.typesafe.scala-logging" %% "scala-logging"          % "3.9.5",
  "com.google.api-client"      % "google-api-client"       % "1.35.1",
  "com.google.http-client"     % "google-http-client-gson" % "1.42.0",
  "org.umlg"                   % "sqlg-h2-dialect"         % versions.sqlgV % Test
)

addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector"      % "0.13.2" cross CrossVersion.full)
