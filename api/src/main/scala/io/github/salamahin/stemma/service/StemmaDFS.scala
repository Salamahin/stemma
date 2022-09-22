package io.github.salamahin.stemma.service

import io.github.salamahin.stemma.domain.Stemma

import scala.collection.mutable

class StemmaDFS(stemma: Stemma) {
  private def familyId(id: String) = s"family_$id"
  private def personId(id: String) = s"person_$id"

  def hasCycles(): Boolean = {
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
    val parents  = mutable.Map.empty[String, String]

    def isCyclic(node: String, nodeParent: Option[String]): Boolean = {
      visited += node

      for {
        u <- adjacency(node)
        if !nodeParent.contains(u)
      } {
        if (visited(u)) return true
        parents(u) = node
        if (isCyclic(u, Some(node))) return true
      }

      false
    }

    for (v <- adjacency.keys) {
      if (!visited(v) && isCyclic(v, parents.get(v))) return true
    }

    false
  }
}
