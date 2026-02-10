ThisBuild / scalaVersion := "2.13.8"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

val options = Seq(
  scalacOptions ++= Seq("-deprecation", "-feature", "-Ylog-classpath"),
  addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1"),
  javacOptions ++= Seq("-source", "11")
)

lazy val api = project.in(file("src/api"))
  .settings(options: _*)

lazy val api_impl_aws_lambda = project.in(file("src/api_impl_aws_lambda"))
  .dependsOn(api)
  .settings(options: _*)

lazy val api_impl_restful = project.in(file("src/api_impl_restful"))
  .dependsOn(api)
  .settings(options: _*)

lazy val migration_lambda = project.in(file("src/migration_lambda"))
  .dependsOn(api)
  .settings(options: _*)
