package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.User
import zio.{Has, UIO}

object auth {
  trait AuthService {
    def canEditPerson(user: User, personId: Long): UIO[Boolean]
    def canEditFamily(user: User, familyId: Long): UIO[Boolean]
  }

  type AUTH = Has[AuthService]
}
