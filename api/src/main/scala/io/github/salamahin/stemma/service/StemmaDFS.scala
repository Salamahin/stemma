package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.Stemma

import scala.collection.mutable

class StemmaDFS(stemma: Stemma) {
  def hasCycles(): Boolean = {
    def familyId(id: String) = s"family_$id"
    def personId(id: String) = s"person_$id"

    val adjacency = stemma
      .families
      .flatMap { fd =>
        val fid  = familyId(fd.id)
        val pids = fd.parents.map(personId)
        val cids = fd.children.map(personId)

        val familyToParents  = fid -> pids
        val familyToChildren = fid -> cids
        val parentToFamilies = pids.map(pid => pid -> List(fid))
        val childToFamilies  = cids.map(cid => cid -> List(fid))

        familyToParents :: familyToChildren :: parentToFamilies ::: childToFamilies
      }
      .groupBy(x => x._1)
      .view
      .mapValues(x => x.flatMap(_._2))
      .toMap

    val visited = mutable.Set.empty[String]
    val parent  = mutable.Map.empty[String, String]

    def isCyclic(v: String, par: Option[String]): Boolean = {
      visited += v
      for (u <- adjacency(v)) {
        if (!par.contains(u)) {
          if (visited(u)) return true

          parent(u) = v

          if (isCyclic(u, Some(v))) return true
        }
      }
      false
    }

    for (v <- adjacency.keys) {
      if (!visited(v) && isCyclic(v, parent.get(v))) return true
    }

    false
  }
}
