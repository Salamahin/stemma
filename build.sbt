ThisBuild / scalaVersion := "2.13.8"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

lazy val versions = new {
  val http4sV = "1.0.0-M30"
  val circeV  = "0.15.0-M1"
  val zioV    = "1.0.13"
  val tapirV  = "0.20.0-M6"
}

libraryDependencies ++= Seq(
  "org.http4s"                  %% "http4s-blaze-server"     % versions.http4sV,
  "io.circe"                    %% "circe-generic"           % versions.circeV,
  "io.circe"                    %% "circe-parser"            % versions.circeV,
  "org.apache.tinkerpop"        % "tinkergraph-gremlin"      % "3.5.2",
  "com.michaelpollmeier"        %% "gremlin-scala"           % "3.5.1.4",
  "io.scalaland"                %% "chimney"                 % "0.6.1",
  "dev.zio"                     %% "zio"                     % versions.zioV,
  "dev.zio"                     %% "zio-interop-cats"        % "2.2.0.1",
  "org.slf4j"                   % "slf4j-api"                % "2.0.0-alpha6",
  "ch.qos.logback"              % "logback-classic"          % "1.3.0-alpha12",
  "com.softwaremill.sttp.tapir" %% "tapir-core"              % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-json-circe"        % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-zio-http4s-server" % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-swagger-ui-bundle" % versions.tapirV,
  "dev.zio"                     %% "zio-test"                % versions.zioV % Test,
  "dev.zio"                     %% "zio-test-sbt"            % versions.zioV % Test
)

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector" % "0.13.2" cross CrossVersion.full)
