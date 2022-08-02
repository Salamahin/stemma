libraryDependencies ++= Seq(
  "dev.zio" %% "zio-lambda" % "1.0.0-RC6"
)

assembly / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case x                             => MergeStrategy.last
}


