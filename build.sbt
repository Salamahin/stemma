ThisBuild / scalaVersion := "2.13.4"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

lazy val versions = new {
  val http4sV = "1.0.0-M10"
  val circeV  = "0.14.0-M3"
  val zioV    = "2.0.0-RC1"
}

libraryDependencies ++= Seq(
  "org.http4s"                      %% "http4s-blaze-server" % versions.http4sV,
  "org.http4s"                      %% "http4s-dsl"          % versions.http4sV,
  "org.http4s"                      %% "http4s-circe"        % versions.http4sV,
  "io.circe"                        %% "circe-generic"       % versions.circeV,
  "io.circe"                        %% "circe-parser"        % versions.circeV,
  "org.apache.tinkerpop"            % "tinkergraph-gremlin"  % "3.4.10",
  "com.michaelpollmeier"            %% "gremlin-scala"       % "3.4.7.8",
  "io.scalaland"                    %% "chimney"             % "0.6.1",
  "dev.zio"                         %% "zio"                 % versions.zioV,
  "com.vladkopanev"                 %% "zio-saga-core"       % "0.4.0",
  "dev.zio"                         %% "zio-interop-cats"    % "3.3.0-RC1",
  "org.slf4j"                       % "slf4j-api"            % "2.0.0-alpha1",
  "ch.qos.logback"                  % "logback-classic"      % "1.3.0-alpha5",
  "org.webjars"                     % "d3js"                 % "6.2.0",
  "org.webjars"                     % "bootstrap"            % "5.0.0-beta1",
  "org.webjars"                     % "jquery"               % "3.5.1",
  "org.webjars"                     % "font-awesome"         % "4.7.0",
  "org.webjars.bowergithub.eligrey" % "filesaver.js"         % "2.0.4",
  "org.scalatest"                   %% "scalatest"           % "3.3.0-SNAP3" % Test
)

addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1")
