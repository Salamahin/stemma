package io.github.salamahin.stemma.gremlin

import org.apache.commons.configuration.BaseConfiguration
import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph

class GraphConfig extends BaseConfiguration {
  addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_EDGE_ID_MANAGER, "UUID")
  addProperty(TinkerGraph.GREMLIN_TINKERGRAPH_VERTEX_ID_MANAGER, "UUID")
}
