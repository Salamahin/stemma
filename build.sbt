ThisBuild / scalaVersion := "2.13.4"
ThisBuild / organization := "io.github.salamahin"

lazy val stemma_root = (project in file("."))
  .settings(
    name := "stemma",
    version := "0.1.0-SNAPSHOT",
    libraryDependencies ++= Seq(
      "org.http4s"  %% "http4s-blaze-server" % "1.0.0-M10",
      "org.http4s"  %% "http4s-dsl"          % "1.0.0-M10",
      "org.http4s"  %% "http4s-circe"        % "1.0.0-M10",
      "io.circe"    %% "circe-generic"       % "0.14.0-M3",
      "io.circe"    %% "circe-literal"       % "0.14.0-M3",
      "dev.zio"     %% "zio"                 % "1.0.3",
      "dev.zio"     %% "zio-interop-cats"    % "2.2.0.1",
      "org.webjars" % "webjars-locator"      % "0.40",
      "org.webjars" % "d3js"                 % "6.2.0",
      "org.webjars" % "bootstrap"            % "5.0.0-beta1",
      "org.webjars" % "jquery"               % "3.5.1"
    )
  )
