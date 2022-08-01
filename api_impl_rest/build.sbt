libraryDependencies ++= Seq(
  "io.d11"                 %% "zhttp"                  % "2.0.0-RC9",
  "com.google.api-client"  % "google-api-client"       % "1.35.1",
  "com.google.http-client" % "google-http-client-gson" % "1.42.0"
)

addCompilerPlugin("com.olegpy" %% "better-monadic-for" % "0.3.1")
