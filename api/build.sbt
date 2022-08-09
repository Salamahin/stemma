testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")

libraryDependencies ++= Seq(
  "com.amazonaws"              % "aws-lambda-java-core"   % "1.2.1",
  "com.amazonaws"              % "aws-lambda-java-events" % "3.11.0",
  "dev.zio"                    %% "zio"                   % Versions.zioV,
  "dev.zio"                    %% "zio-json"              % "0.3.0-RC10",
  "org.typelevel"              %% "cats-core"             % "2.8.0",
  "com.michaelpollmeier"       %% "gremlin-scala"         % "3.5.3.2",
  "org.umlg"                   % "sqlg-core"              % Versions.sqlgV,
  "org.umlg"                   % "sqlg-postgres-dialect"  % Versions.sqlgV,
  "org.umlg"                   % "sqlg-hikari"            % Versions.sqlgV,
  "org.postgresql"             % "postgresql"             % "42.4.1",
  "com.typesafe.scala-logging" %% "scala-logging"         % "3.9.4",
  "ch.qos.logback"             % "logback-classic"        % "1.3.0-alpha16",
  "dev.zio"                    %% "zio-test"              % Versions.zioV % Test,
  "dev.zio"                    %% "zio-test-sbt"          % Versions.zioV % Test,
  "org.umlg"                   % "sqlg-h2-dialect"        % Versions.sqlgV % Test,
  "org.scalatest"              %% "scalatest"             % "3.3.0-SNAP3" % Test
)

assembly / assemblyMergeStrategy := {
  case PathList("META-INF", xs@_*) => MergeStrategy.discard
  case x => MergeStrategy.last
}
assembly / assemblyJarName := "stemma-api.jar"

