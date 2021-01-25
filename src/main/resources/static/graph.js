function stemma(el) {
    const width = window.innerWidth, height = window.innerHeight;
    const childCircleR = 10;
    const spouseCircleR = 5;
    const nodeColor = '#69b3a2';
    const childRelationColor = "grey";
    const spouseRelationColor = '#69b3a2';
    const childRelationWidth = 0.5;
    const spouseRelationWidth = 2;

    const vertexes = [];
    const edges = [];

    this.addVertex = function(v) {
        vertexes.push(v);
        update();
    }

    this.addEdge = function(e) {
        edges.push(e);
        update();
    }

    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    const simulation = d3.forceSimulation(vertexes)
        .force("link", d3.forceLink()
            .id(d => d.id)
            .links(edges)
        )
        .force("x", d3.forceX(width / 2).strength(0.4))
        .force("y", d3.forceY(height / 2).strength(0.6))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force("link", d3.forceLink().id(d => d.id).distance(() => 100).strength(1.5))
        .force("collide", d3.forceCollide().radius(d => d.r * 20).iterations(10).strength(1))
        .force("repelForce", d3.forceManyBody().strength(-3000).distanceMin(85));

    const svg = d3.select(el)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    const defs = svg.append('defs');

    defs.append('marker')
        .attr('id', 'child-arrow')
        .attr('viewBox', '0 0 10 6')
        .attr('refX', 2 * childCircleR + childRelationWidth * 2)
        .attr('refY', 3)
        .attr('markerWidth', 10)
        .attr('markerHeight', 6)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('orient', 'auto')
        .style('fill', childRelationColor)
        .append('path')
        .attr('d', 'M 0 0 L 10 3 L 0 6 Z');

    defs.append('marker')
        .attr('id', 'spouse-arrow')
        .attr('viewBox', '0 0 10 6')
        .attr('refX', 2 * spouseCircleR + spouseRelationWidth * 2)
        .attr('refY', 3)
        .attr('markerWidth', 12)
        .attr('markerHeight', 8)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('orient', 'auto')
        .style('fill', spouseRelationColor)
        .append('path')
        .attr('d', 'M 0 0 L 10 3 L 0 6 Z');

    svg.call(d3
        .drag()
        .container(svg.node())
        .subject(event => simulation.find(event.x, event.y))
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    );

    const edgesGroup = svg.append("g").attr("class", "links");
    const vertexGroup = svg.append("g").attr("class", "nodes");
    let edgeElements, vertexElements, textElements;

    var update = function () {
        edgeElements = edgesGroup.selectAll("line").data(edges);
        vertexElements = vertexGroup.selectAll("g").data(vertexes);

        edgeElements.exit().remove();
        vertexElements.exit().remove();

        const edgeEnter = edgeElements
            .enter()
            .append("line")
            .attr("stroke-width", d => d.type == "child"? childRelationWidth + "px" : spouseRelationWidth + "px")
            .attr("stroke", d => d.type == "child"? childRelationColor : spouseRelationColor)
            .attr('marker-end', d => d.type == "child"? 'url(#child-arrow)' : 'url(#spouse-arrow)');

        const vertexEnter = vertexElements
            .enter()
            .append("g");

        vertexEnter
            .append("text")
            .text(d => d.name)
            .style("font-size", "11px")
            .style("text-anchor", "middle")
            .attr("dy", "25");

        vertexEnter
            .append("circle")
            .attr("fill", nodeColor)
            .attr("r", d => d.type == "family"? spouseCircleR : childCircleR);

        edgeElements = edgeEnter.merge(edgeElements);
        vertexElements = vertexEnter.merge(vertexElements);

        simulation.nodes(vertexes);
        simulation.force("link").links(edges);
        simulation.on("tick", function() {
            edgeElements
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y)

            vertexElements.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
        });

        simulation.alphaTarget(0.7).restart();
    }

    update();
}

function drawGraph() {
    graph = new stemma("#data_viz");

    setTimeout(function() {
        graph.addVertex({ id: "k1", name: "Голощапов Данила Сергеевич", birtDate: "1990-06-11", type: "person" });
        graph.addVertex({ id: "k2", name: "Сулерова Ангелина Сергеевна", birtDate: "1991-03-14", type: "person" });
        graph.addVertex({ id: "f1", type: "family" });
        graph.addEdge({ id: "1", source: "k1", target: "f1", type: "spouse" });
        graph.addEdge({ id: "2", source: "k2", target: "f1", type: "spouse" });
    }, 5000);

    setTimeout(function() {
        graph.addVertex({ id: "k4", name: "Голощапов Сергей Георгиевич", type: "person"});
        graph.addVertex({ id: "k5", name: "Голощапов Евгения Анатольевна", type: "person"});
        graph.addVertex({ id: "k6", name: "Голощапов Егор Сергеевич", type: "person"});
        graph.addVertex({ id: "k7", name: "Голощапов Федор Сергеевич", type: "person"});
        graph.addVertex({ id: "k8", name: "Голощапова Ольга Сергеевна", type: "person"});
        graph.addVertex({ id: "f3", type: "family" });

        graph.addEdge({ id: "4", source: "k4", target: "f3", type: "spouse" });
        graph.addEdge({ id: "5", source: "k5", target: "f3", type: "spouse" });
        graph.addEdge({ id: "7", source: "f3", target: "k1", type: "child" });
        graph.addEdge({ id: "8", source: "f3", target: "k6", type: "child" });
        graph.addEdge({ id: "9", source: "f3", target: "k7", type: "child" });
        graph.addEdge({ id: "10", source: "f3", target: "k8", type: "child" });
    }, 10000);
}