ThisBuild / scalaVersion := "2.13.8"
ThisBuild / organization := "io.github.salamahin"

name := "stemma"
version := "0.1.0-SNAPSHOT"

lazy val server = project


addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector"      % "0.13.2" cross CrossVersion.full)

server / assembly / assemblyMergeStrategy := {
  case PathList("META-INF", _*) => MergeStrategy.discard
  case _                        => MergeStrategy.last
}
server / assembly / assemblyJarName := "stemma_service.jar"