<script lang="ts">

    export let families

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
</script>