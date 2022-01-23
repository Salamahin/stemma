package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}

sealed trait StemmaError
final case class NoSuchPersonId(id: Long)                                            extends StemmaError
final case class NoSuchFamilyId(id: Long)                                            extends StemmaError
final case class ChildAlreadyBelongsToFamily(familyId: Long, personId: Long)          extends StemmaError
final case class ChildBelongsToDifferentFamily(existentFamilyId: Long, childId: Long) extends StemmaError
final case class ChildDoesNotBelongToFamily(familyId: Long, childId: Long)            extends StemmaError
final case class SpouseAlreadyBelongsToFamily(familyId: Long, personId: Long)         extends StemmaError
final case class SpouseBelongsToDifferentFamily(familyId: Long, personId: Long)       extends StemmaError
final case class SpouseDoesNotBelongToFamily(familyId: Long, personId: Long)          extends StemmaError
final case class IncompleteFamily()                                                 extends StemmaError
final case class CompositeError(errs: List[StemmaError])                            extends StemmaError
final case class DuplicatedIds(duplicatedIds: Seq[Long])                             extends StemmaError

object StemmaError {
  import io.circe.generic.auto._
  import org.latestbit.circe.adt.codec._

  implicit val encoder: Encoder[StemmaError] = JsonTaggedAdtCodec.createEncoder[StemmaError]("type")
  implicit val decoder: Decoder[StemmaError] = JsonTaggedAdtCodec.createDecoder[StemmaError]("type")
}
