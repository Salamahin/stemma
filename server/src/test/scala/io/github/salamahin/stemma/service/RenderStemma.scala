package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.{FamilyDescription, PersonDescription, Stemma}

trait RenderStemma {
  object render {
    def unapply(stemma: Stemma) = {
      val Stemma(people: List[PersonDescription], families: List[FamilyDescription]) = stemma
      val personById                                           = people.map(p => (p.id, p)).toMap

      val descr = families
        .map {
          case FamilyDescription(_, parents, children, _) =>
            val parentNames   = parents.map(personById).map(_.name).sorted.mkString("(", ", ", ")")
            val childrenNames = children.map(personById).map(_.name).sorted.mkString("(", ", ", ")")

            s"$parentNames parentsOf $childrenNames"
        }

      Some(descr)
    }
  }
}
