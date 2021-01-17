ThisBuild / scalaVersion := "2.13.4"
ThisBuild / organization := "io.github.salamahin"

lazy val versions = new {
  val scalatraV = "2.7.1"
}

lazy val stemma_root = (project in file("."))
  .settings(
    name := "stemma",
    version := "0.1.0-SNAPSHOT",
    libraryDependencies ++= Seq(
      "org.json4s"        %% "json4s-jackson"   % "3.7.0-M7",
      "org.scalatra"      %% "scalatra"         % versions.scalatraV,
      "org.scalatra"      %% "scalatra-scalate" % versions.scalatraV,
      "org.scalatra"      %% "scalatra-json"    % versions.scalatraV,
      "ch.qos.logback"    % "logback-classic"   % "1.2.3" % "runtime",
      "org.eclipse.jetty" % "jetty-webapp"      % "9.4.35.v20201120" % "container",
      "javax.servlet"     % "javax.servlet-api" % "3.1.0" % "provided",
      "org.webjars"       % "d3js"              % "6.2.0",
      "org.webjars"       % "bootstrap"         % "5.0.0-beta1",
      "org.webjars"       % "jquery"            % "3.5.1"
    )
  )

enablePlugins(JettyPlugin)
