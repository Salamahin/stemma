package io.github.salamahin.stemma.tinkerpop

import gremlin.scala.{ScalaGraph, TraversalSource}
import io.github.salamahin.stemma.domain.{StemmaError, UnknownError}
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource

import scala.util.Try

object Transaction {
  import cats.syntax.bifunctor._

  def transactionSafe[T](graph: ScalaGraph)(f: TraversalSource => T): T = {
    val tx  = graph.tx()
    val res = f(TraversalSource(tx.begin(): GraphTraversalSource))
    tx.commit()
    res
  }

  def transaction[T](graph: ScalaGraph)(f: TraversalSource => Either[StemmaError, T]): Either[StemmaError, T] = {
    val tx = graph.tx()

    Try(f(TraversalSource(tx.begin(): GraphTraversalSource)))
      .toEither
      .leftMap(err => UnknownError(err): StemmaError)
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
