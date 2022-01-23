package io.github.salamahin.stemma.domain

import io.circe.{Decoder, Encoder}
import org.latestbit.circe.adt.codec.JsonTaggedAdtCodec

sealed trait StemmaError
final case class NoSuchPersonId(id: String)                                               extends StemmaError
final case class NoSuchFamilyId(id: String)                                               extends StemmaError
final case class ChildAlreadyBelongsToFamily(familyId: String, personId: String)          extends StemmaError
final case class ChildBelongsToDifferentFamily(existentFamilyId: String, childId: String) extends StemmaError
final case class ChildDoesNotBelongToFamily(familyId: String, childId: String)            extends StemmaError
final case class SpouseAlreadyBelongsToFamily(familyId: String, personId: String)         extends StemmaError
final case class SpouseBelongsToDifferentFamily(familyId: String, personId: String)       extends StemmaError
final case class SpouseDoesNotBelongToFamily(familyId: String, personId: String)          extends StemmaError
final case class IncompleteFamily()                                                       extends StemmaError
final case class CompositeError(errs: List[StemmaError])                                  extends StemmaError
final case class DuplicatedIds(duplicatedIds: Seq[String])                                extends StemmaError

object StemmaError {
  import io.circe.generic.auto._
  import org.latestbit.circe.adt.codec._

  implicit val encoder: Encoder[StemmaError] = JsonTaggedAdtCodec.createEncoder[StemmaError]("type")
  implicit val decoder: Decoder[StemmaError] = JsonTaggedAdtCodec.createDecoder[StemmaError]("type")
}
