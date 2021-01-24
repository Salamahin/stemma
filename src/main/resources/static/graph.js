function drawStemma(dataVertexes, dataEdges) {
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

    function showModal(event) {
        $("#addKinsmanModal").show();
      var modalTitle = exampleModal.querySelector('.modal-title')
      var modalBodyInput = exampleModal.querySelector('.modal-body input')

      modalTitle.textContent = 'New message to wtfff'
      modalBodyInput.value = "wtf"
    }

    const width = window.innerWidth, height = window.innerHeight;
    const childCircleR = 10;
    const spouseCircleR = 5;
    const nodeColor = '#69b3a2';
    const childRelationColor = "grey";
    const spouseRelationColor = '#69b3a2';
    const childRelationWidth = 0.5;
    const spouseRelationWidth = 2;

    const simulation = d3.forceSimulation(dataVertexes)
        .force("link", d3.forceLink()
            .id(d => d.id)
            .links(dataEdges)
        )
        .force("x", d3.forceX(width / 2).strength(0.4))
        .force("y", d3.forceY(height / 2).strength(0.6))
        .force("link", d3.forceLink().id(d => d.id).distance(() => 100).strength(1.5))
        .force("collide", d3.forceCollide().radius(d => d.r * 20).iterations(10).strength(1))
        .force("repelForce", d3.forceManyBody().strength(-3000).distanceMin(85));

    const svg = d3.select("#data_viz")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    const defs = svg.append('defs')

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

    const link = svg
        .selectAll("line")
        .data(dataEdges)
        .enter()
        .append("line")

    link
        .filter(d => d.type == "child")
        .attr("stroke-width", childRelationWidth + "px")
        .attr("stroke", childRelationColor)
        .attr('marker-end', 'url(#child-arrow)')
        .style('fill', 'none');

    link
        .filter(d => d.type == "spouse")
        .attr("stroke-width", spouseRelationWidth + "px")
        .attr("stroke", spouseRelationColor)
        .attr('marker-end', 'url(#spouse-arrow)')
        .style('fill', 'none');


    const node = svg
        .selectAll("node")
        .data(dataVertexes)
        .enter()
        .append("g")

    node
        .append("text")
        .text(d => d.name)
        .style("font-size", "11px")
        .style("text-anchor", "middle")
        .attr("dy", "25");

    node
        .append("circle")
        .attr("fill", nodeColor)
        .attr("r", d => d.type == "family"? spouseCircleR : childCircleR);

    node
        .filter(d => d.type == "person")
        .attr("r", "childCircleR")
        .on("click", showModal);

    simulation.nodes(dataVertexes);
    simulation.force("link").links(dataEdges);
    simulation.on("tick", function() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)

        node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    });
}