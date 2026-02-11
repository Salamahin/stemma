package io.github.salamahin.stemma.service

import org.flywaydb.core.Flyway

object MigrationRunner {
  def migrate(jdbcUrl: String, jdbcUser: String, jdbcPassword: String): Unit = {
    Flyway.configure()
      .dataSource(jdbcUrl, jdbcUser, jdbcPassword)
      .baselineOnMigrate(true)
      .load()
      .migrate()
  }
}
