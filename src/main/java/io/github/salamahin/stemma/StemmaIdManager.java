package io.github.salamahin.stemma;

import org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph;

import java.util.concurrent.atomic.AtomicInteger;

class StemmaIdManager implements TinkerGraph.IdManager<String> {
    private static final AtomicInteger id = new AtomicInteger(0);
    private final String prefix;

    public StemmaIdManager(String prefix) {
        this.prefix = prefix;
    }

    @Override
    public String getNextId(final TinkerGraph graph) {
        return prefix + id.getAndIncrement();
    }

    @Override
    public String convert(Object id) {
        if (null == id)
            return null;
        else if (id instanceof String)
            return (String) id;
        else throw new IllegalArgumentException("Unexpected class of ID");
    }

    @Override
    public boolean allow(final Object id) {
        return id instanceof String;
    }
}
