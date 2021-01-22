const dataVertexes = [
    { id: "k1", name: "Голощапов Данила Сергеевич", birtDate: "1990-06-11", type: "person" },
    { id: "k2", name: "Сулерова Ангелина Сергеевна", birtDate: "1991-03-14", type: "person" },
    { id: "k3", name: "Абрамова Светлана Ивановна", type: "person"},
    { id: "k4", name: "Голощапов Сергей Георгиевич", type: "person"},
    { id: "k5", name: "Голощапов Евгения Анатольевна", type: "person"},
    { id: "f1", type: "family" },
    { id: "f2", type: "family" },
    { id: "f3", type: "family" }
];


const dataEdges = [
    { id: "1", source: "k1", target: "f1", type: "spouse" },
    { id: "2", source: "k2", target: "f1", type: "spouse" },
    { id: "3", source: "k3", target: "f2", type: "spouse" },
    { id: "4", source: "k4", target: "f3", type: "spouse" },
    { id: "5", source: "k5", target: "f3", type: "spouse" },
    { id: "6", source: "k2", target: "f2", type: "child" },
    { id: "7", source: "k1", target: "f3", type: "child" }
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
    .attr("stroke-width", d => (d.type == "spouse"? "4px" : "0.5px"))
    .attr("stroke", d => (d.type == "spouse"? "#69b3a2" : "grey"));

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
    .attr("fill", "#69b3a2")
    .attr("r", d => d.type == "family"? 5 : 10);

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