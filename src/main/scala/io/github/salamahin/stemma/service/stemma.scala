package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain._
import io.github.salamahin.stemma.service.repo.REPO
import io.github.salamahin.stemma.tinkerpop.StemmaRepository
import zio._

object stemma {
  class StemmaService(repo: StemmaRepository) {
    def newFamily(family: FamilyDescription): IO[StemmaError, Family]                      = IO.fromEither(repo.newFamily(family))
    def updateFamily(familyId: String, family: FamilyDescription): IO[StemmaError, Family] = IO.fromEither(repo.updateFamily(familyId, family))
    def removeFamily(familyId: String): IO[NoSuchFamilyId, Unit]                           = IO.fromEither(repo.removeFamily(familyId))
    def removePerson(id: String): IO[StemmaError, Unit]                                    = IO.fromEither(repo.removePerson(id))
    def updatePerson(id: String, description: PersonDescription): IO[StemmaError, Unit]    = IO.fromEither(repo.updatePerson(id, description))
    def stemma(): UIO[Stemma]                                                              = UIO(repo.stemma())
  }

  type STEMMA = Has[StemmaService]

  val live: URLayer[REPO, STEMMA] = ZIO
    .environment[REPO]
    .map(_.get)
    .flatMap(_.repo)
    .map(new StemmaService(_))
    .toLayer
}
