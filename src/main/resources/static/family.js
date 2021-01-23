const dataVertexes = [
    { id: "k1", name: "Голощапов Данила Сергеевич", birtDate: "1990-06-11", type: "person" },
    { id: "k2", name: "Сулерова Ангелина Сергеевна", birtDate: "1991-03-14", type: "person" },
    { id: "k3", name: "Абрамова Светлана Ивановна", type: "person"},
    { id: "k4", name: "Голощапов Сергей Георгиевич", type: "person"},
    { id: "k5", name: "Голощапов Евгения Анатольевна", type: "person"},
    { id: "k6", name: "Голощапов Егор Сергеевич", type: "person"},
    { id: "k7", name: "Голощапов Федор Сергеевич", type: "person"},
    { id: "k8", name: "Голощапова Ольга Сергеевна", type: "person"},
    { id: "k9", name: "Стихова Мария", type: "person"},
    { id: "k10", name: "Зайнулина Мария", type: "person"},
    { id: "k11", name: "Голощапова Ульяна Егоровна", type: "person"},
    { id: "k12", name: "Иван Шмидт", type: "person"},
    { id: "f1", type: "family" },
    { id: "f2", type: "family" },
    { id: "f3", type: "family" },
    { id: "f4", type: "family" },
    { id: "f5", type: "family" },
    { id: "f6", type: "family" }
];


const dataEdges = [
    { id: "1", source: "k1", target: "f1", type: "spouse" },
    { id: "2", source: "k2", target: "f1", type: "spouse" },
    { id: "3", source: "k3", target: "f2", type: "spouse" },
    { id: "4", source: "k4", target: "f3", type: "spouse" },
    { id: "5", source: "k5", target: "f3", type: "spouse" },
    { id: "6", source: "f2", target: "k2", type: "child" },
    { id: "7", source: "f3", target: "k1", type: "child" },
    { id: "8", source: "f3", target: "k6", type: "child" },
    { id: "9", source: "f3", target: "k7", type: "child" },
    { id: "10", source: "f3", target: "k8", type: "child" },
    { id: "15", source: "f5", target: "k11", type: "child" },
    { id: "11", source: "k9", target: "f4", type: "spouse" },
    { id: "12", source: "k7", target: "f4", type: "spouse" },
    { id: "14", source: "k10", target: "f5", type: "spouse" },
    { id: "16", source: "k6", target: "f5", type: "spouse" },
    { id: "17", source: "k12", target: "f6", type: "spouse" },
    { id: "18", source: "k8", target: "f6", type: "spouse" }
];

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

const width = window.innerWidth, height = window.innerHeight;
const childCircleR = 10;
const spouseCircleR = 5;
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
    .attr("fill", spouseRelationColor)
    .attr("r", d => d.type == "family"? spouseCircleR : childCircleR);

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