lazy val versions = new {
  val http4sV = "0.23.7"
  val circeV  = "0.14.1"
  val zioV    = "1.0.13"
  val tapirV  = "0.20.0-M6"
  val sqlgV   = "2.1.5"
}

testFrameworks += new TestFramework("zio.test.sbt.ZTestFramework")
scalacOptions ++= Seq("-deprecation", "-feature")

libraryDependencies ++= Seq(
  "org.http4s"                  %% "http4s-blaze-server"     % versions.http4sV,
  "org.http4s"                  %% "http4s-blaze-client"     % versions.http4sV,
  "org.http4s"                  %% "http4s-circe"            % versions.http4sV,
  "io.circe"                    %% "circe-generic"           % versions.circeV,
  "io.circe"                    %% "circe-parser"            % versions.circeV,
  "io.circe"                    %% "circe-generic-extras"    % versions.circeV,
  "org.umlg"                    % "sqlg-core"                % versions.sqlgV,
  "org.umlg"                    % "sqlg-postgres-dialect"    % versions.sqlgV,
  "com.michaelpollmeier"        %% "gremlin-scala"           % "3.5.1.4",
  "dev.zio"                     %% "zio"                     % versions.zioV,
  "dev.zio"                     %% "zio-interop-cats"        % "2.2.0.1",
  "org.slf4j"                   % "slf4j-api"                % "2.0.0-alpha6",
  "ch.qos.logback"              % "logback-classic"          % "1.3.0-alpha12",
  "com.google.api-client"       % "google-api-client"        % "1.33.1",
  "com.google.http-client"      % "google-http-client-gson"  % "1.41.2",
  "com.softwaremill.sttp.tapir" %% "tapir-core"              % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-json-circe"        % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-zio-http4s-server" % versions.tapirV,
  "com.softwaremill.sttp.tapir" %% "tapir-swagger-ui-bundle" % versions.tapirV,
  "dev.zio"                     %% "zio-test"                % versions.zioV % Test,
  "dev.zio"                     %% "zio-test-sbt"            % versions.zioV % Test,
  "org.umlg"                    % "sqlg-h2-dialect"          % versions.sqlgV % Test
)

addCompilerPlugin("com.olegpy"    %% "better-monadic-for" % "0.3.1")
addCompilerPlugin("org.typelevel" % "kind-projector"      % "0.13.2" cross CrossVersion.full)
