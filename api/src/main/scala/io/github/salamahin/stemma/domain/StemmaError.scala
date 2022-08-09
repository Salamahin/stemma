package io.github.salamahin.stemma.domain

import org.apache.commons.lang3.exception.ExceptionUtils
import zio.json.{DeriveJsonEncoder, JsonEncoder}

sealed trait StemmaError                                extends Throwable
case class UnknownError(cause: Throwable)               extends Throwable(cause) with StemmaError
case class RequestDeserializationProblem(descr: String) extends Throwable with StemmaError

case class NoSuchPersonId(id: String) extends Throwable with StemmaError
case class NoSuchFamilyId(id: String) extends Throwable with StemmaError
case class NoSuchStemmaId(id: String) extends Throwable with StemmaError
case class NoSuchUserId(id: String)   extends Throwable with StemmaError

case class ChildAlreadyBelongsToFamily(familyId: String, personId: String) extends Throwable with StemmaError
case class ChildDoesNotBelongToFamily(familyId: String, childId: String)   extends Throwable with StemmaError
case class SpouseDoesNotBelongToFamily(familyId: String, personId: String) extends Throwable with StemmaError
case class IncompleteFamily()                                              extends Throwable with StemmaError
case class DuplicatedIds(duplicatedIds: Seq[String])                       extends Throwable with StemmaError

case class AccessToFamilyDenied(familyId: String) extends Throwable with StemmaError
case class AccessToPersonDenied(personId: String) extends Throwable with StemmaError
case class AccessToStemmaDenied(stemmaId: String) extends Throwable with StemmaError

case class IsNotTheOnlyStemmaOwner(stemmaId: String) extends Throwable with StemmaError

case class InvalidInviteToken() extends Throwable with StemmaError
case class ForeignInviteToken() extends Throwable with StemmaError

object StemmaError {
  implicit val throwableEnc: JsonEncoder[Throwable] = JsonEncoder.string.contramap(th => ExceptionUtils.getStackTrace(th))
  implicit val encoder: JsonEncoder[StemmaError]    = DeriveJsonEncoder.gen[StemmaError]
}
