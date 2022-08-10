package io.github.salamahin.stemma.apis.serverless.aws

import java.sql.DriverManager
import java.sql.Connection
import scala.collection.mutable.ListBuffer

case class UserInfo(id: Long, email: String)

class SelectDemo(jdbcdUrl: String, user: String, password: String) {
  def selectUsers(): ListBuffer[UserInfo] = {
    var connection: Connection = null
    val buf = scala.collection.mutable.ListBuffer.empty[UserInfo]
    try {
      Class.forName("org.postgresql.Driver")
      connection = DriverManager.getConnection(jdbcdUrl, user, password)
      val statement = connection.createStatement()

      val resultSet = statement.executeQuery("select * from \"V_user\"; ")
      while (resultSet.next()) {
        val id = resultSet.getLong("ID")
        val email = resultSet.getString("email")
        buf.addOne(UserInfo(id, email))
      }
    }
    finally {
      if (connection != null) {
        connection.close()
      }
    }
    buf
  }
}

object Main {
  def main(args: Array[String]): Unit = {
    val demo = new SelectDemo(
      "jdbc:postgresql://ec2-54-228-125-183.eu-west-1.compute.amazonaws.com:5432/d3up22chdeothb",
      "pvmydparizqmhr",
      "c098cce134604e5f82bd933ba54696ac325b427106122e50a50a25d897340a24")
    val value = demo.selectUsers()
    println(value)
  }
}
