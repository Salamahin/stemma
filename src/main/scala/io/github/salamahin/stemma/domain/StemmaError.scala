package io.github.salamahin.stemma.domain

import io.circe.generic.extras.semiauto.{deriveConfiguredDecoder, deriveConfiguredEncoder}
import io.circe.{Decoder, Encoder}

sealed trait StemmaError
final case class NoSuchPersonId(id: Long)                                             extends StemmaError
final case class NoSuchFamilyId(id: Long)                                             extends StemmaError
final case class ChildAlreadyBelongsToFamily(familyId: Long, personId: Long)          extends StemmaError
final case class ChildBelongsToDifferentFamily(existentFamilyId: Long, childId: Long) extends StemmaError
final case class ChildDoesNotBelongToFamily(familyId: Long, childId: Long)            extends StemmaError
final case class SpouseAlreadyBelongsToFamily(familyId: Long, personId: Long)         extends StemmaError
final case class SpouseBelongsToDifferentFamily(familyId: Long, personId: Long)       extends StemmaError
final case class SpouseDoesNotBelongToFamily(familyId: Long, personId: Long)          extends StemmaError
final case class IncompleteFamily()                                                   extends StemmaError
final case class CompositeError(errs: List[StemmaError])                              extends StemmaError
final case class DuplicatedIds(duplicatedIds: Seq[Long])                              extends StemmaError

object StemmaError extends Discriminated {
  implicit val encoder: Encoder[StemmaError] = deriveConfiguredEncoder[StemmaError]
  implicit val decoder: Decoder[StemmaError] = deriveConfiguredDecoder[StemmaError]
}
