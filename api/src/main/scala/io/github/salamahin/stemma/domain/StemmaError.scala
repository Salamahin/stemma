package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

import java.io.{PrintWriter, StringWriter}
import scala.util.Using

sealed trait StemmaError                                extends Throwable
case class UnknownError(cause: Throwable)               extends Throwable(cause) with StemmaError
case class RequestDeserializationProblem(descr: String) extends StemmaError

case class NoSuchPersonId(id: String) extends StemmaError

case class ChildAlreadyBelongsToFamily(familyId: String, personId: String) extends StemmaError
case class IncompleteFamily()                                              extends StemmaError
case class DuplicatedIds(duplicatedIds: String)                            extends StemmaError

case class AccessToFamilyDenied(familyId: String) extends StemmaError
case class AccessToPersonDenied(personId: String) extends StemmaError
case class AccessToStemmaDenied(stemmaId: String) extends StemmaError

case class IsNotTheOnlyStemmaOwner(stemmaId: String) extends StemmaError

case class InvalidInviteToken() extends StemmaError
case class ForeignInviteToken() extends StemmaError
case class StemmaHasCycles()    extends StemmaError

object StemmaError {
  private def stacktraceToString(th: Throwable) = {
    val sw = new StringWriter
    Using(new PrintWriter(sw)) { pw => th.printStackTrace(pw) }.get
    sw.toString
  }

  implicit val throwableEnc: JsonEncoder[Throwable] = JsonEncoder.string.contramap(th => stacktraceToString(th))
  implicit val encoder: JsonEncoder[StemmaError]    = DeriveJsonEncoder.gen[StemmaError]
}
