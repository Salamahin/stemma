package io.github.salamahin.stemma.domain

case class User(userId: String, email: String) {
  override def toString: String = {
    val Array(name, domain) = email.split("@")
    val redactedName        = name.take(3) + List.fill(name.length - 3)('*').mkString

    s"User($userId, $redactedName@$domain)"
  }
}
