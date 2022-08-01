ThisBuild / scalaVersion := "2.13.8"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

lazy val api = project
  .disablePlugins(AssemblyPlugin)

lazy val api_impl_aws_lambda = project
  .dependsOn(api)
  .settings(
    assembly / assemblyMergeStrategy := {
      case PathList("META-INF", xs @ _*) => MergeStrategy.discard
      case x                             => MergeStrategy.last
    }
  )

lazy val api_impl_rest = project
  .dependsOn(api)
  .disablePlugins(AssemblyPlugin)
