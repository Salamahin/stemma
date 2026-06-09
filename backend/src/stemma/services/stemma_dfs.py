from collections import defaultdict

from stemma.domain.responses import Stemma


def has_cycles(stemma: Stemma) -> bool:
    adjacency: dict[str, list[str]] = defaultdict(list)
    nodes: set[str] = set()
    for family in stemma.families:
        nodes.update(family.parents)
        nodes.update(family.children)
        for parent in family.parents:
            adjacency[parent].extend(family.children)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = dict.fromkeys(nodes, WHITE)

    def is_cyclic(start: str) -> bool:
        stack: list[tuple[str, int]] = [(start, 0)]
        color[start] = GRAY
        while stack:
            node, index = stack[-1]
            neighbors = adjacency[node]
            if index < len(neighbors):
                stack[-1] = (node, index + 1)
                neighbor = neighbors[index]
                state = color[neighbor]
                if state == GRAY:
                    return True
                if state == WHITE:
                    color[neighbor] = GRAY
                    stack.append((neighbor, 0))
            else:
                color[node] = BLACK
                stack.pop()
        return False

    for node in nodes:
        if color[node] == WHITE and is_cyclic(node):
            return True
    return False
