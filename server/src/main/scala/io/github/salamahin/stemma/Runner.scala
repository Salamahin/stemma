package io.github.salamahin.stemma

import java.sql.Timestamp

object Runner extends App {
  val ts = List(
    1643581680615L, 1643581737158L, 1643581737225L, 1643578972563L, 1643583125196L, 1643583146347L, 1643583146368L, 1643583152081L, 1643583152265L, 1643584892272L
  )

  ts.foreach(ts => {
    println(new Timestamp(ts))
  })
}
