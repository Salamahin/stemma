package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.storage.Tables._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.Await
import scala.concurrent.duration._

object MigrationRunner {
  private val allSchemas =
    qStemmaUsers.schema ++
      qStemmas.schema ++
      qPeople.schema ++
      qFamilies.schema ++
      qFamiliesOwners.schema ++
      qPeopleOwners.schema ++
      qStemmaOwners.schema ++
      qSpouses.schema ++
      qChildren.schema

  def migrate(jdbcUrl: String, jdbcUser: String, jdbcPassword: String): Unit = {
    val db = Database.forURL(jdbcUrl, user = jdbcUser, password = jdbcPassword, driver = "org.postgresql.Driver")
    try {
      Await.result(db.run(allSchemas.createIfNotExists), 60.seconds)
    } finally {
      db.close()
    }
  }
}
