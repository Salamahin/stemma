libraryDependencies ++= Seq(
  "dev.zio" %% "zio-lambda" % "1.0.0-RC6",
  "com.amazonaws" % "aws-lambda-java-core" % "1.2.1",
  "com.amazonaws" % "aws-lambda-java-events" % "3.11.0"
)

enablePlugins(PackPlugin)
packMain := Map()
