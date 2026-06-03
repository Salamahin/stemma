from collections import defaultdict

from stemma.domain.responses import Stemma


def has_cycles(stemma: Stemma) -> bool:
    adjacency: dict[str, list[str]] = defaultdict(list)
    for family in stemma.families:
        fid = f"family_{family.id}"
        parent_nodes = [f"person_{pid}" for pid in family.parents]
        child_nodes = [f"person_{cid}" for cid in family.children]
        adjacency[fid].extend(parent_nodes)
        adjacency[fid].extend(child_nodes)
        for pnode in parent_nodes:
            adjacency[pnode].append(fid)
        for cnode in child_nodes:
            adjacency[cnode].append(fid)

    visited: set[str] = set()

    def is_cyclic(start: str) -> bool:
        stack: list[tuple[str, str | None]] = [(start, None)]
        while stack:
            node, parent = stack.pop()
            if node in visited:
                return True
            visited.add(node)
            for neighbor in adjacency[node]:
                if neighbor == parent:
                    continue
                if neighbor in visited:
                    return True
                stack.append((neighbor, node))
        return False

    for node in list(adjacency):
        if node not in visited and is_cyclic(node):
            return True
    return False
