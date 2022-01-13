package io.github.salamahin.stemma

import io.github.salamahin.stemma.response.{Family, Person, Stemma}

object StemmaRenderer {
  def apply(stemma: Stemma) = {
    val Stemma(people: List[Person], families: List[Family]) = stemma

    val personById = people.map(p => (p.id, p)).toMap

    families
      .map {
        case Family(_, parents, children) =>
          val parentNames   = parents.map(personById).map(_.name).sorted.mkString("(", " + ", ")")
          val childrenNames = children.map(personById).map(_.name).sorted.mkString("(", " + ", ")")

          s"$parentNames -- parents of --> $childrenNames"
      }
  }
}
