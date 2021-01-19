ThisBuild / scalaVersion := "2.13.4"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

lazy val versions = new {
  val http4sV = "1.0.0-M10"
}
lazy val root = (project in file(".")).enablePlugins(SbtTwirl)

libraryDependencies ++= Seq(
  "org.http4s"  %% "http4s-blaze-server" % versions.http4sV,
  "org.http4s"  %% "http4s-dsl"          % versions.http4sV,
  "org.http4s"  %% "http4s-circe"        % versions.http4sV,
  "org.http4s"  %% "http4s-twirl"        % versions.http4sV,
  "io.circe"    %% "circe-generic"       % "0.14.0-M3",
  "dev.zio"     %% "zio"                 % "1.0.3",
  "dev.zio"     %% "zio-interop-cats"    % "2.2.0.1",
  "org.webjars" % "d3js"                 % "6.2.0",
  "org.webjars" % "bootstrap"            % "5.0.0-beta1",
  "org.webjars" % "jquery"               % "3.5.1",
  "org.webjars" % "font-awesome"         % "4.7.0"
)

addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1")
