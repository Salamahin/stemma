package io.github.salamahin.stemma.service

import com.vladkopanev.zio.saga.Saga

object SagaExt {
  def collectAll[R, E, A](sagas: Iterable[Saga[R, E, A]]): Saga[R, E, List[A]] = sagas.foldLeft(Saga.succeed(Nil): Saga[R, E, List[A]]) {
    case (acc, saga) => acc.flatMap(accumulated => saga.map(next => accumulated :+ next))
  }
}
