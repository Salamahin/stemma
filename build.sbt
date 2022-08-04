ThisBuild / scalaVersion := "2.13.8"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

val commonOptsions = Seq(
  scalacOptions ++= Seq("-deprecation", "-feature", "-Ylog-classpath"),
  addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1"),
  javacOptions ++= Seq("-source", "11")
)

lazy val api = project
  .settings(commonOptsions: _*)

lazy val api_impl_aws_lambda = project
  .dependsOn(api)
  .settings(commonOptsions: _*)

lazy val api_impl_rest = project
  .dependsOn(api)
  .settings(commonOptsions: _*)
