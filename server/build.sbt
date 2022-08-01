lazy val versions = new {
  val zioV   = "2.0.0"
  val sqlgV  = "2.1.6"
}

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
scalacOptions ++= Seq("-deprecation", "-feature", "-Ylog-classpath")

libraryDependencies ++= Seq(
  "dev.zio"                    %% "zio"                  % versions.zioV,
  "dev.zio"                    %% "zio-lambda"           % "1.0.0-RC6",
  "dev.zio"                    %% "zio-json"             % "0.3.0-RC10",
  "org.typelevel"              %% "cats-core"            % "2.8.0",
  "com.michaelpollmeier"       %% "gremlin-scala"        % "3.5.3.2",
  "org.umlg"                   % "sqlg-core"             % versions.sqlgV,
  "org.umlg"                   % "sqlg-postgres-dialect" % versions.sqlgV,
  "org.umlg"                   % "sqlg-hikari"           % versions.sqlgV,
  "com.typesafe.scala-logging" %% "scala-logging"        % "3.9.4",
  "ch.qos.logback"             % "logback-classic"       % "1.3.0-alpha16",
  "dev.zio"                    %% "zio-test"             % versions.zioV % Test,
  "dev.zio"                    %% "zio-test-sbt"         % versions.zioV % Test,
  "org.umlg"                   % "sqlg-h2-dialect"       % versions.sqlgV % Test
)

addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector"      % "0.13.2" cross CrossVersion.full)
