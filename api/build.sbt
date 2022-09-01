testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")

libraryDependencies ++= Seq(
  "com.typesafe.scala-logging" %% "scala-logging"                     % "3.9.5",
  "org.slf4j"                  % "slf4j-api"                          % "2.0.0",
  "ch.qos.logback"             % "logback-classic"                    % "1.2.11",
  "com.amazonaws"              % "aws-lambda-java-core"               % "1.2.1",
  "com.amazonaws"              % "aws-lambda-java-events"             % "3.11.0",
  "org.postgresql"             % "postgresql"                         % "42.5.0",
  "dev.zio"                    %% "zio"                               % Versions.zioV,
  "dev.zio"                    %% "zio-json"                          % "0.3.0-RC10",
  "org.typelevel"              %% "cats-core"                         % "2.8.0",
  "com.typesafe.slick"         %% "slick"                             % Versions.slickV,
  "com.typesafe.slick"         %% "slick-hikaricp"                    % Versions.slickV,
  "io.github.scottweaver"      %% "zio-2-0-testcontainers-postgresql" % "0.8.0" % Test,
  "dev.zio"                    %% "zio-test"                          % Versions.zioV % Test,
  "dev.zio"                    %% "zio-test-sbt"                      % Versions.zioV % Test,
  "org.scalatest"              %% "scalatest"                         % "3.3.0-SNAP3" % Test
)

enablePlugins(PackPlugin)
packMain := Map()
