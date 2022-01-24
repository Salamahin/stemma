package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.{Family, Person, Stemma}

trait RenderStemma {
  object render {
    def unapply(stemma: Stemma) = {
      val Stemma(people: List[Person], families: List[Family]) = stemma
      val personById                                           = people.map(p => (p.id, p)).toMap

      val descr = families
        .map {
          case Family(_, parents, children) =>
            val parentNames   = parents.map(personById).map(_.name).sorted.mkString("(", ", ", ")")
            val childrenNames = children.map(personById).map(_.name).sorted.mkString("(", ", ", ")")

            s"$parentNames parentsOf $childrenNames"
        }

      Some(descr)
    }
  }
}
