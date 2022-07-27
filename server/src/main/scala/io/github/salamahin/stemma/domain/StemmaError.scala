package io.github.salamahin.stemma.domain

import io.circe.generic.extras.Configuration
import io.circe.generic.extras.semiauto.deriveConfiguredEncoder
import io.circe.{Encoder, Json}
import org.apache.commons.lang3.exception.ExceptionUtils

import java.util.UUID

sealed trait StemmaError

final case class UnknownError(cause: Throwable) extends StemmaError

final case class NoSuchPersonId(id: String) extends StemmaError
final case class NoSuchFamilyId(id: String) extends StemmaError
final case class NoSuchStemmaId(id: String) extends StemmaError
final case class NoSuchUserId(id: String)   extends StemmaError

final case class ChildAlreadyBelongsToFamily(familyId: String, personId: String) extends StemmaError
final case class ChildDoesNotBelongToFamily(familyId: String, childId: String)   extends StemmaError
final case class SpouseDoesNotBelongToFamily(familyId: String, personId: String) extends StemmaError
final case class IncompleteFamily()                                              extends StemmaError
final case class DuplicatedIds(duplicatedIds: Seq[String])                       extends StemmaError

final case class MissingBearerHeader()                  extends Throwable with StemmaError
final case class AccessToFamilyDenied(familyId: String) extends StemmaError
final case class AccessToPersonDenied(personId: String) extends StemmaError
final case class AccessToStemmaDenied(stemmaId: String) extends StemmaError

final case class UserIsAlreadyFamilyOwner(familyId: String) extends StemmaError
final case class UserIsAlreadyPersonOwner(personId: String) extends StemmaError
final case class UserIsAlreadyGraphOwner(stemmaId: String)  extends StemmaError

final case class IsNotTheOnlyStemmaOwner(stemmaId: String) extends StemmaError

final case class InvalidInviteToken() extends StemmaError
final case class ForeignInviteToken() extends StemmaError

final case class TracedStemmaError(traceId: UUID, cause: StemmaError) extends StemmaError

trait Discriminated {
  implicit val circeConfig = Configuration.default.withDiscriminator("type")
}

object StemmaError extends Discriminated {
  implicit val encoder: Encoder[StemmaError] = deriveConfiguredEncoder[StemmaError]
}

object UnknownError {
  implicit val encoder: Encoder[UnknownError] = Encoder.instance[UnknownError] { err =>
    Json.obj(
      "type"  -> Json.fromString("UnknownError"),
      "cause" -> Json.fromString(ExceptionUtils.getStackTrace(err.cause))
    )
  }
}
