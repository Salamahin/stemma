package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.Stemma

import scala.annotation.tailrec

class StemmaAnalytics(stemma: Stemma) {
  def hasCycles(): Boolean = {
    @tailrec
    def loop(vertexes: List[String], visitedVertexes: Set[String], directions: Map[String, List[String]]): Boolean =
      vertexes match {
        case Nil => false
        case v :: remained =>
          if (visitedVertexes.contains(v)) true
          else loop(directions.getOrElse(v, Nil) ::: remained, visitedVertexes + v, directions)
      }

    def familyId(id: String) = s"family_$id"
    def personId(id: String) = s"person_$id"

    val directions = stemma
      .families
      .flatMap { fd =>
        val fid = familyId(fd.id)
        fid -> fd.children.map(personId) :: fd.parents.map(id => personId(id) -> List(fid))
      }
      .groupBy(x => x._1)
      .view
      .mapValues(x => x.flatMap(_._2))
      .toMap

    (stemma.people.map(pd => personId(pd.id)) ++ stemma.families.map(fd => familyId(fd.id)))
      .exists(vid => loop(List(vid), Set.empty, directions))
  }
}
