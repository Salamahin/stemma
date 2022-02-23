<script lang="ts">
    import * as d3 from 'd3'
    import {Stemma} from "../model";
    import {onMount} from 'svelte';

    let stemmaS: Stemma = {
        families: [
            {
                id: "f1",
                parents: ["p1"],
                children: ["p2", "p3"]
            },
            {
                id: "f2",
                parents: ["p3", "p4"],
                children: ["p5"]
            }
        ],
        people: [
            {
                id: "p1",
                name: "ivan"
            },
            {
                id: "p2",
                name: "tolya"
            },
            {
                id: "p3",
                name: "kolya"
            },
            {
                id: "p4",
                name: "masha"
            },
            {
                id: "p5",
                name: "katya"
            },
        ]
    }

    let nodes = [
        ...stemmaS.people.map(p => ({
            id: p.id
        })),
        ...stemmaS.families.map(f => ({
            id: f.id
        }))
    ]

    let links = [
        ...stemmaS.families.flatMap(f => f.children.map(c => ({
            id: `${f.id}_${c}`,
            source: f.id,
            target: c
        }))),
        ...stemmaS.families.flatMap(f => f.parents.map(p => ({
            id: `${p}_${f.id}`,
            source: p,
            target: f.id
        })))
    ]

    function ForceGraph({
                            nodes, // an iterable of node objects (typically [{id}, …])
                            links // an iterable of link objects (typically [{source, target}, …])
                        }, {
                            nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
                            nodeGroup, // given d in nodes, returns an (ordinal) value for color
                            nodeGroups, // an array of ordinal values representing the node groups
                            nodeTitle, // given d in nodes, a title string
                            nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
                            nodeStroke = "#fff", // node stroke color
                            nodeStrokeWidth = 1.5, // node stroke width, in pixels
                            nodeStrokeOpacity = 1, // node stroke opacity
                            nodeRadius = 5, // node radius, in pixels
                            nodeStrength,
                            linkSource = ({source}) => source, // given d in links, returns a node identifier string
                            linkTarget = ({target}) => target, // given d in links, returns a node identifier string
                            linkStroke = "#999", // link stroke color
                            linkStrokeOpacity = 0.6, // link stroke opacity
                            linkStrokeWidth = 1.5, // given d in links, returns a stroke width in pixels
                            linkStrokeLinecap = "round", // link stroke linecap
                            linkStrength,
                            colors = d3.schemeTableau10, // an array of color strings, for the node groups
                            width = 640, // outer width, in pixels
                            height = 400, // outer height, in pixels
                            invalidation // when this promise resolves, stop the simulation
                        } = {}) {
        // Compute values.
        const N = d3.map(nodes, nodeId).map(intern);
        const LS = d3.map(links, linkSource).map(intern);
        const LT = d3.map(links, linkTarget).map(intern);
        if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
        const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
        const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
        const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);
        const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);


        // Replace the input nodes and links with mutable objects for the simulation.
        nodes = d3.map(nodes, (_, i) => ({id: N[i]}));
        links = d3.map(links, (_, i) => ({source: LS[i], target: LT[i]}));

        // Compute default domains.
        if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

        // Construct the scales.
        const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

        // Construct the forces.
        const forceNode = d3.forceManyBody();
        const forceLink = d3.forceLink(links).id(({index: i}) => N[i]);
        if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
        if (linkStrength !== undefined) forceLink.strength(linkStrength);

        const simulation = d3.forceSimulation(nodes)
            .force("link", forceLink)
            .force("charge", forceNode)
            .force("center", d3.forceCenter())
            .on("tick", ticked);

        const svg = d3.create("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [-width / 2, -height / 2, width, height])
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

        const link = svg.append("g")
            .attr("stroke", typeof linkStroke !== "function" ? linkStroke : null)
            .attr("stroke-opacity", linkStrokeOpacity)
            .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
            .attr("stroke-linecap", linkStrokeLinecap)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = svg.append("g")
            .attr("fill", nodeFill)
            .attr("stroke", nodeStroke)
            .attr("stroke-opacity", nodeStrokeOpacity)
            .attr("stroke-width", nodeStrokeWidth)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", nodeRadius)
            .call(drag(simulation));

        if (W) link.attr("stroke-width", ({index: i}) => W[i]);
        if (L) link.attr("stroke", ({index: i}) => L[i]);
        if (G) node.attr("fill", ({index: i}) => color(G[i]));
        if (T) node.append("title").text(({index: i}) => T[i]);
        if (invalidation != null) invalidation.then(() => simulation.stop());

        function intern(value) {
            return value !== null && typeof value === "object" ? value.valueOf() : value;
        }

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        }

        function drag(simulation) {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
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

            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

        return Object.assign(svg.node(), {scales: {color}});
    }

    onMount(() => {
        let svg = new ForceGraph({nodes, links})
        document.getElementById("chart").appendChild(svg)
    })


    /*

    function stemma(el) {
            const width = window.innerWidth, height = window.innerHeight;
            const childCircleR = 10;
            const spouseCircleR = 5;

            const defaultColor = "grey"

            const childRelationWidth = 0.5;
            const spouseRelationWidth = 2;

            var _vertexes = [];
            var _edges = [];

            const clickObservers = []

            this.onPersonClicked = function(fn) {
                clickObservers.push(fn);
            }

            this.updateData = function(people, families, children, spouses) {


                const pp = people.map(p => {
                    let newPerson = {
                        type: "person"
                    };
                    return Object.assign(newPerson, p);
                });

                const ff = families.map(f => {
                    let newFamily = {
                        type: "family"
                    };
                    return Object.assign(newFamily, f);
                });

                const cc = children.map(c => {
                    let newChild = {
                        type: "child"
                    };
                    return Object.assign(newChild, c);
                });

                const ss = spouses.map(s => {
                    let newSpouse = {
                        type: "spouse"
                    };
                    return Object.assign(newSpouse, s);
                });

                _vertexes = pp.concat(ff);
                _edges = cc.concat(ss);
                update();
            }

            function color(person) {
                return d3.interpolatePlasma(person.generation / _max_generation);
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
                .force("x", d3.forceX(width / 2).strength(0.5))
                .force("y", d3.forceY(height / 2).strength(0.5))
                .force("link", d3.forceLink().id(d => d.id).distance(() => 100).strength(1.5))
                .force("collide", d3.forceCollide().radius(d => d.r * 20))
                .force("repelForce", d3.forceManyBody().strength(-2500).distanceMin(85));

            const svg = d3.select(el)
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .call(d3.zoom().on("zoom", function (event) {
                    svg.attr("transform", event.transform)
                }))
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
                .style('fill', defaultColor)
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
                .style('fill', defaultColor)
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

            const update = function () {
                edgesGroup.selectAll("line").remove();
                vertexGroup.selectAll("g").remove();

                const edgeElements = edgesGroup
                    .selectAll("line")
                    .data(_edges)
                    .join(
                        enter => enter.append("line"),
                        update => update,
                        exit => exit.remove()
                    )
                    .attr("stroke-width", d => d.type == "child"? childRelationWidth + "px" : spouseRelationWidth + "px")
                    .attr("stroke", defaultColor)
                    .attr('marker-end', d => d.type == "child"? 'url(#child-arrow)' : 'url(#spouse-arrow)');

                const vertexElements = vertexGroup
                    .selectAll("g")
                    .data(_vertexes)
                    .join(
                        enter => enter.append("g"),
                        update => update,
                        exit => exit.remove()
                    );


                vertexElements
                    .append("circle")
                    .attr("fill", d => d.type == "family"? defaultColor : color(d))
                    .attr("r", d => d.type == "family"? spouseCircleR : childCircleR)
                    .on('click', (event, d) => {
                        clickObservers.forEach(fn => fn(d));
                    })
                    .on('mouseenter', (event, d) => {
                        if (event.defaultPrevented || d.type == "family") return;
                        d3
                            .select(event.currentTarget)
                            .attr("r", childCircleR * 1.2);
                    })
                    .on('mouseleave', (event, d) => {
                        if (event.defaultPrevented || d.type == "family") return;
                        d3
                            .select(event.currentTarget)
                            .attr("r", childCircleR);
                    });

                vertexElements
                    .append("text")
                    .text(d => d.name)
                    .style("font-size", d => d.updated? "15px" : "11px")
                    .style("font-weight", d => d.updated? "bold" : "normal")
                    .style("text-anchor", "middle")
                    .attr("dy", "25");

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
                simulation.alphaTarget(0.2).restart();
            }

            update();
        }

     */


</script>

<div id="chart"></div>