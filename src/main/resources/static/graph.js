Array.prototype.inArray = function(comparer) {
    for(var i = 0; i < this.length; i++) {
        if(comparer(this[i])) return true;
    }
    return false;
};

Array.prototype.pushIfNotExist = function(element, comparer) {
    if (!this.inArray(comparer)) {
        this.push(element);
    }
};

function stemma(el) {
    const width = window.innerWidth, height = window.innerHeight;
    const childCircleR = 10;
    const spouseCircleR = 5;
    const nodeColor = '#69b3a2';
    const childRelationColor = "grey";
    const spouseRelationColor = '#69b3a2';
    const childRelationWidth = 0.5;
    const spouseRelationWidth = 2;

    const _vertexes = [];
    const _edges = [];

    this.addPerson = function(v) {
        let newPerson = {
            type: "person"
        };
        _vertexes.pushIfNotExist(Object.assign(newPerson, v), next => next.id === v.id);
        update();
    }

    this.addFamily = function(v) {
        let newFamily = {
            type: "family"
        };
        _vertexes.pushIfNotExist(Object.assign(newFamily, v), next => next.id === v.id);
        update();
    }

    this.addChild = function(e) {
        let newChild = {
            type: "child"
        };
        _edges.pushIfNotExist(Object.assign(newChild, e), next => next.id === e.id);
        update();
    }

    this.addSpouse = function(e) {
        let newSpouse = {
            type: "spouse"
        };
        _edges.pushIfNotExist(Object.assign(newSpouse, e), next => next.id === e.id);
        update();
    }

    this.people = function() {
        const p = _vertexes.filter(x => x.type === "person");
        return p;
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

    const simulation = d3.forceSimulation(_vertexes)
        .force("link", d3.forceLink()
            .id(d => d.id)
            .links(_edges)
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
    let edgeElements, vertexElements;

    const update = function () {
        edgeElements = edgesGroup.selectAll("line").data(_edges);
        vertexElements = vertexGroup.selectAll("g").data(_vertexes);

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

        simulation.nodes(_vertexes);
        simulation.force("link").links(_edges);
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