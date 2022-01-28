package io.github.salamahin.stemma.tinkerpop

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain.{StemmaError, UserIsAlreadyFamilyOwner}
import org.apache.commons.lang3.exception.ExceptionUtils
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource

import scala.util.Try

object Transaction {
  import cats.syntax.bifunctor._

  def transaction[T](graph: ScalaGraph)(f: TraversalSource => Either[StemmaError, T]): Either[StemmaError, T] = {
    val tx = graph.tx()

    Try(f(TraversalSource(tx.begin(): GraphTraversalSource)))
      .toEither
      .leftMap(err => UserIsAlreadyFamilyOwner(ExceptionUtils.getStackTrace(err)): StemmaError)
      .flatten
      .bimap(
        err => {
          tx.rollback()
          err
        },
        res => {
          tx.commit()
          tx.close()
          res
        }
      )
  }
}