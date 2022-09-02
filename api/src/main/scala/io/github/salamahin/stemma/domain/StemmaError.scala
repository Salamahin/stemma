package io.github.salamahin.stemma.domain

import zio.json.{DeriveJsonEncoder, JsonEncoder}

import java.io.{PrintWriter, StringWriter}
import scala.util.Using

sealed trait StemmaError                                extends Throwable
case class UnknownError(cause: Throwable)               extends Throwable(cause) with StemmaError
case class RequestDeserializationProblem(descr: String) extends Throwable with StemmaError

case class NoSuchPersonId(id: String) extends Throwable with StemmaError

case class ChildAlreadyBelongsToFamily(familyId: String, personId: String) extends Throwable with StemmaError
case class IncompleteFamily()                                              extends Throwable with StemmaError
case class DuplicatedIds(duplicatedIds: String)                            extends Throwable with StemmaError

case class AccessToFamilyDenied(familyId: String) extends Throwable with StemmaError
case class AccessToPersonDenied(personId: String) extends Throwable with StemmaError
case class AccessToStemmaDenied(stemmaId: String) extends Throwable with StemmaError

case class IsNotTheOnlyStemmaOwner(stemmaId: String) extends Throwable with StemmaError

case class InvalidInviteToken() extends Throwable with StemmaError
case class ForeignInviteToken() extends Throwable with StemmaError

object StemmaError {
  private def stacktraceToString(th: Throwable) = {
    val sw = new StringWriter
    Using(new PrintWriter(sw)) { pw => th.printStackTrace(pw) }.get
    sw.toString
  }

  implicit val throwableEnc: JsonEncoder[Throwable] = JsonEncoder.string.contramap(th => stacktraceToString(th))
  implicit val encoder: JsonEncoder[StemmaError]    = DeriveJsonEncoder.gen[StemmaError]
}
