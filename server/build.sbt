lazy val versions = new {
  val circeV = "0.14.1"
  val zioV   = "2.0.0-RC2"
  val sqlgV  = "2.1.5"
}

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
scalacOptions ++= Seq("-deprecation", "-feature", "-Ylog-classpath")

libraryDependencies ++= Seq(
  "dev.zio"                    %% "zio"                    % versions.zioV,
//  "dev.zio"                    %% "zio-interop-cats"       % "3.3.0-RC2",
  "dev.zio"                    %% "zio-test"               % versions.zioV % Test,
  "dev.zio"                    %% "zio-test-sbt"           % versions.zioV % Test,
  "io.d11"                     %% "zhttp"                  % "2.0.0-RC3",
  "io.circe"                   %% "circe-parser"           % versions.circeV,
  "io.circe"                   %% "circe-generic-extras"   % versions.circeV,
  "com.michaelpollmeier"       %% "gremlin-scala"          % "3.5.1.4",
  "org.umlg"                   % "sqlg-core"               % versions.sqlgV,
  "org.umlg"                   % "sqlg-postgres-dialect"   % versions.sqlgV,
  "ch.qos.logback"             % "logback-classic"         % "1.3.0-alpha12",
  "com.typesafe.scala-logging" %% "scala-logging"          % "3.9.4",
  "com.google.api-client"      % "google-api-client"       % "1.33.1",
  "com.google.http-client"     % "google-http-client-gson" % "1.41.2",
  "org.umlg"                   % "sqlg-h2-dialect"         % versions.sqlgV % Test
)

addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector"      % "0.13.2" cross CrossVersion.full)
