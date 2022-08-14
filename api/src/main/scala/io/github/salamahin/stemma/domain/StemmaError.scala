package io.github.salamahin.stemma.domain

import org.apache.commons.lang3.exception.ExceptionUtils
import zio.json.{DeriveJsonEncoder, JsonEncoder}

sealed trait StemmaError                                extends Throwable
case class UnknownError(cause: Throwable)               extends Throwable(cause) with StemmaError
case class RequestDeserializationProblem(descr: String) extends Throwable with StemmaError

case class NoSuchPersonId(id: Long) extends Throwable with StemmaError

case class ChildAlreadyBelongsToFamily(familyId: Long, personId: Long) extends Throwable with StemmaError
case class IncompleteFamily()                                          extends Throwable with StemmaError
case class DuplicatedIds(duplicatedIds: Long)                          extends Throwable with StemmaError

case class AccessToFamilyDenied(familyId: Long) extends Throwable with StemmaError
case class AccessToPersonDenied(personId: Long) extends Throwable with StemmaError
case class AccessToStemmaDenied(stemmaId: Long) extends Throwable with StemmaError

case class IsNotTheOnlyStemmaOwner(stemmaId: Long) extends Throwable with StemmaError

case class InvalidInviteToken() extends Throwable with StemmaError
case class ForeignInviteToken() extends Throwable with StemmaError

object StemmaError {
  implicit val throwableEnc: JsonEncoder[Throwable] = JsonEncoder.string.contramap(th => ExceptionUtils.getStackTrace(th))
  implicit val encoder: JsonEncoder[StemmaError]    = DeriveJsonEncoder.gen[StemmaError]
}
