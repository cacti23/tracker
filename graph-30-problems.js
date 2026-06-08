// ═══════════════════════════════════════════════════════════════════════════════
// 30 ADVANCED GRAPH PROBLEMS - LeetCode Interview Documentation
// Ready to paste into data.js graph.questions object
// ═══════════════════════════════════════════════════════════════════════════════

'LC_332': {
  leetcode: 332, title: 'Reconstruct Itinerary', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/reconstruct-itinerary/',
  templateRefs: ['P2'], tags: ['graph','dfs','eulerian-path','directed-graph','backtracking','path-reconstruction'],
  keyInsight: 'Eulerian path problem: visit every edge exactly once. Use Hierholzer\'s algorithm with DFS. Key: build adjacency list with sorted destinations (for lexicographically smallest itinerary), use a stack to track the path, backtrack when stuck, and reverse the final path.',
  shrinkTrigger: 'graph[from] is a list of destinations sorted. dfs(node): while graph[node] has destinations: next=pop(graph[node]); dfs(next). path.append(node). Return path reversed.',
  timeComplexity: 'O(E log E) due to sorting destinations; O(E) DFS traversal',
  spaceComplexity: 'O(V + E) for adjacency list and recursion stack',
  gotcha: 'Must reverse the path at the end — the DFS builds it backwards. Use sorted() on destination lists or a heap to ensure lexicographically smallest result. Stack-based iterative Hierholzer is harder to debug than recursive.',
  faangNote: 'Google 7/10, Meta 6/10. Tests understanding of Eulerian paths and graph traversal reconstruction. Lead with Hierholzer by name — signals graph theory knowledge.',
  alternateApproaches: [
    { technique: 'Greedy DFS without Eulerian theory', tradeoff: 'Simpler approach but requires careful backtracking. Not as clean theoretically but arrives at the same answer.', complexity: 'O(E) time, O(V+E) space' }
  ]
},

'LC_847': {
  leetcode: 847, title: 'Shortest Path Visiting All Nodes', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/shortest-path-visiting-all-nodes/',
  templateRefs: ['P7'], tags: ['graph','bitmask-dp','tsp','bfs','shortest-path','state-compression'],
  keyInsight: 'Traveling Salesman variant: visit all n nodes exactly once with minimum path length. State = (node, visitedMask). Use BFS to find shortest path. n ≤ 15 makes 2^n state space feasible. Key: initial state is (each node, 1 << each node) — start from every possible node.',
  shrinkTrigger: 'memo = {}. queue = [(node, 1<<node, distance) for each node]. visited = {(node, mask)}. BFS: for each (node, mask, dist): if mask == (1<<n)-1: return dist. For each neighbor: newMask = mask | (1<<neighbor); if (neighbor, newMask) not visited: enqueue.',
  timeComplexity: 'O(n * 2^n * n) = O(n² * 2^n) for state exploration and neighbor checks',
  spaceComplexity: 'O(n * 2^n) for memoization table',
  gotcha: 'Must try all n starting nodes — the optimal path may not start from node 0. Use BFS not DFS to ensure shortest distance. The visitedMask bitmask tracks visited set — bitwise OR to add nodes.',
  faangNote: 'Google 8/10, Amazon 6/10. Tests bitmask DP recognition and TSP variant understanding. State upfront: "With n ≤ 15, bitmask DP is feasible. State = (current node, visited set as bitmask). BFS finds shortest path."',
  alternateApproaches: [
    { technique: 'Held-Karp DP (dynamic programming)', tradeoff: 'dp[mask][node] = minimum distance to visit all nodes in mask, ending at node. Same O(n²*2^n) but cleaner DP formulation.', complexity: 'O(n² * 2^n) time, O(n * 2^n) space' }
  ]
},

'LC_1361': {
  leetcode: 1361, title: 'Validate Binary Tree Nodes', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/validate-binary-tree-nodes/',
  templateRefs: ['P2'], tags: ['graph','dfs','tree-validation','directed-graph','cycle-detection'],
  keyInsight: 'Validate if n nodes form a valid binary tree: (1) exactly one root (in-degree 0), (2) all other nodes have in-degree 1, (3) no cycles (graph is acyclic), (4) all nodes are reachable from root. Use DFS from the root to verify connectivity and detect cycles.',
  shrinkTrigger: 'in_degree=[0]*n. For each node: if leftChild exists: in_degree[leftChild]++; if rightChild exists: in_degree[rightChild]++. Find root (in_degree==0). If no root or >1 root: return false. DFS from root: if revisit or null: valid. Count reached nodes. Return visited_count == n.',
  timeComplexity: 'O(n) for building in-degrees + O(n) DFS',
  spaceComplexity: 'O(n) for in-degree array and DFS stack',
  gotcha: 'Must check in-degrees first to find root. If a node has in-degree > 1, multiple parents exist (not a tree). DFS detects cycles (revisiting a node) and ensures all nodes are reachable from root.',
  faangNote: 'Google 6/10, Amazon 7/10. Tests tree validation discipline. Lead with: "A valid tree has exactly one root, n-1 edges, and is connected and acyclic."',
  alternateApproaches: [
    { technique: 'Union-Find', tradeoff: 'Union each child with parent. If union fails (child already has parent) or forms cycle, invalid. Same O(n) complexity but less intuitive.', complexity: 'O(n * α(n)) time, O(n) space' }
  ]
},

'LC_2050': {
  leetcode: 2050, title: 'Parallel Courses III', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/parallel-courses-iii/',
  templateRefs: ['P4'], tags: ['graph','topological-sort','dag','dynamic-programming','weighted-graph'],
  keyInsight: 'Topological sort with DP: each course has a duration; must respect prerequisites (DAG). DP state: earliest finish time for course i = duration[i] + max(earliest finish of all prerequisites). Use topological sort (Kahn\'s) and process in order. Answer = max earliest finish time across all courses.',
  shrinkTrigger: 'in_degree = [0]*n. For each prerequisite pair (u,v): add v to adj[u]; in_degree[v]++. dp[i] = duration[i]. Kahn\'s: process in topological order. When processing course u: for each dependent v: dp[v] = max(dp[v], dp[u] + duration[v]). Return max(dp).',
  timeComplexity: 'O(V + E) for topological sort',
  spaceComplexity: 'O(V + E) for adjacency list and DP array',
  gotcha: 'DP update is on outgoing edges (dependents), not incoming. When finishing course u, all courses dependent on u must wait at least until u finishes. The order of processing courses matters — process in topological order.',
  faangNote: 'Google 8/10, Amazon 7/10. Tests topological sort + DP combination. State: "I use topological sort to process in dependency order, then DP to track earliest finish times."',
  alternateApproaches: [
    { technique: 'DFS with memoization', tradeoff: 'Compute earliest finish for each course recursively, memoize to avoid recomputation. Same O(V+E) but requires care to avoid cycles.', complexity: 'O(V + E) time, O(V) space' }
  ]
},

'LC_2642': {
  leetcode: 2642, title: 'Design Graph With Shortest Path Calculator', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/design-graph-with-shortest-path-calculator/',
  templateRefs: ['P5'], tags: ['graph','dijkstra','weighted-graph','shortest-path','priority-queue','design-pattern'],
  keyInsight: 'Precompute all-pairs shortest paths on initialization using Floyd-Warshall (for dense graphs, V ≤ 100). O(V³) preprocessing, O(1) per query. Alternative: store adjacency list, run Dijkstra per query. Choose based on V and query frequency.',
  shrinkTrigger: 'Floyd-Warshall: dist = adjacency matrix initialized. For k in 0..n: for i in 0..n: for j in 0..n: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]). shortestPath(u,v): return dist[u][v] if finite, else -1.',
  timeComplexity: 'O(V³) preprocessing; O(1) per query',
  spaceComplexity: 'O(V²) for distance matrix',
  gotcha: 'Floyd-Warshall handles negative weights but NOT negative cycles. If a negative cycle exists, shortestPath may return incorrect results. The three nested loops must process k as the outermost loop — swapping loop order breaks correctness.',
  faangNote: 'Google 7/10, Amazon 6/10. Tests all-pairs shortest path knowledge and design trade-offs. Lead with: "I precompute shortest paths using Floyd-Warshall — O(V³) once, O(1) per query. For sparse graphs or many queries, Dijkstra per query is better."',
  alternateApproaches: [
    { technique: 'Dijkstra per query', tradeoff: 'If queries are sparse or V is large, computing Dijkstra on-demand is more efficient than preprocessing all pairs.', complexity: 'O((V + E) log V) per query' }
  ]
},

'LC_815': {
  leetcode: 815, title: 'Bus Routes', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/bus-routes/',
  templateRefs: ['P1'], tags: ['graph','bfs','multi-source-bfs','implicit-graph','optimization'],
  keyInsight: 'Implicit graph: buses are nodes, buses are connected if they share a stop. Multi-source BFS from all buses containing start → find shortest path to any bus containing target. Optimize by building stop→buses map to avoid O(stops²) comparisons.',
  shrinkTrigger: 'stop_to_buses = {stop: [bus indices]}. visited_buses = set(). queue = [buses containing start]. visited_stops = {start}. BFS: for each bus: for each stop on bus: if stop==target: return distance. For each unvisited bus containing stop: add to queue.',
  timeComplexity: 'O(n * s) where n=bus count, s=stops per bus',
  spaceComplexity: 'O(n * s) for stop→buses map',
  gotcha: 'Comparing buses by their stop lists is O(stops²) per pair — too slow. Build a stop→buses index instead. Mark visited buses, not stops — a stop can appear on multiple buses.',
  faangNote: 'Meta 7/10, Google 6/10. Tests implicit graph recognition and BFS optimization. Lead with: "This is an implicit graph where buses are nodes. I build a stop→buses map to quickly find which buses serve each stop."',
  alternateApproaches: []
},

'LC_2959': {
  leetcode: 2959, title: 'Number of Possible Sets of Closing Branches', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/number-of-possible-sets-of-closing-branches/',
  templateRefs: ['P3'], tags: ['graph','union-find','dsu','bitmask-enumeration','connected-components'],
  keyInsight: 'Count subsets of nodes such that removing them leaves remaining nodes "isolated" (distance > threshold). Use bitmask enumeration of nodes to close (2^n subsets). For each subset, use Union-Find to detect if remaining graph is fully disconnected. Union two remaining nodes only if distance ≤ threshold.',
  shrinkTrigger: 'For mask in 0..2^n: If nodes in mask are "closed": remaining_nodes = all not in mask. Build distances between remaining nodes (Floyd-Warshall or Dijkstra). Use Union-Find: union pairs with distance ≤ threshold. If num_components == remaining_nodes.count: valid subset, increment answer.',
  timeComplexity: 'O(2^n * (n³ or n² log n)) due to subset enumeration and distance computation per subset',
  spaceComplexity: 'O(n²) for distance matrix',
  gotcha: 'Must precompute all-pairs shortest paths (Floyd-Warshall) to quickly check distances. For each subset, remaining nodes form a valid configuration if they partition into isolated components. Union-Find counts components efficiently.',
  faangNote: 'Google 8/10. Tests bitmask enumeration + Union-Find. Challenge: optimize subset testing without TLE. State: "I enumerate subsets to close, use Floyd-Warshall for distances, then Union-Find to count components among remaining nodes."',
  alternateApproaches: []
},

'LC_2976': {
  leetcode: 2976, title: 'Minimum Cost to Convert String I', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-cost-to-convert-string-i/',
  templateRefs: ['P5'], tags: ['graph','floyd-warshall','shortest-path','weighted-graph','character-transformation'],
  keyInsight: 'Character transformation graph: nodes are 26 letters, edges are conversions with costs. Precompute shortest path between all letter pairs using Floyd-Warshall. For each character in source string, find cheapest path to target character. Sum all transformation costs.',
  shrinkTrigger: 'dist = [n×n matrix, initially ∞]. For each conversion (a, b, cost): dist[a][b] = min(dist[a][b], cost). Floyd-Warshall on 26×26 matrix. result = 0. For i in 0..len(source): if source[i] != target[i]: result += dist[source[i]][target[i]]. If infinite, return -1.',
  timeComplexity: 'O(26³) = O(1) for Floyd-Warshall; O(len(source)) to compute transformations',
  spaceComplexity: 'O(26²) = O(1) for 26×26 distance matrix',
  gotcha: 'Floyd-Warshall must handle 0 initialization correctly: dist[i][i]=0, all others initially ∞, then update with provided edges. If a character cannot be transformed to target (dist remains ∞), return -1.',
  faangNote: 'Google 7/10, Amazon 6/10. Tests Floyd-Warshall on a fixed 26-letter alphabet. Direct application of all-pairs shortest path.',
  alternateApproaches: [
    { technique: 'Dijkstra per character pair', tradeoff: 'If transformation costs are unidirectional, Dijkstra from each source character works. Similar complexity but overkill when alphabet is fixed.', complexity: 'O(26 * (E log V)) time' }
  ]
},

'LC_3015': {
  leetcode: 3015, title: 'Count the Number of Houses at a Certain Distance', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/count-the-number-of-houses-at-a-certain-distance-i/',
  templateRefs: ['P1'], tags: ['graph','bfs','circular-graph','shortest-path','distance-counting'],
  keyInsight: 'Circular graph (houses 1..n with edges to neighbors and possibly another edge). Use BFS from each house to compute distances to all other houses. Key: circular structure means no cycles other than the outer ring — careful edge modeling.',
  shrinkTrigger: 'For each house u in 1..n: BFS(u) computes distances to all other houses. For each distance d: count[d] += 1 (number of houses at distance d from u). Return count.',
  timeComplexity: 'O(n²) for n BFS traversals, each O(n)',
  spaceComplexity: 'O(n) for BFS queue and visited set per BFS',
  gotcha: 'The graph structure is critical — parse the problem description carefully. The circular arrangement with potential shortcuts requires correct edge modeling. Each BFS is O(n) and independent.',
  faangNote: 'Google 7/10. Tests BFS on a specialized graph structure. The challenge is parsing the problem to model the graph correctly.',
  alternateApproaches: []
},

'LC_2092': {
  leetcode: 2092, title: 'Find All People With Secret', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/find-all-people-with-secret/',
  templateRefs: ['P2','P3'], tags: ['graph','dfs','union-find','timing-simulation','connected-components','state-tracking'],
  keyInsight: 'People learn secrets through meetings. Key: process meetings in chronological order. Within each minute, all meetings at that time happen in parallel — people who already know the secret can spread it. Use Union-Find to group people who meet, then DFS to mark everyone in connected groups where at least one person knows the secret.',
  shrinkTrigger: 'Sort meetings by time. For each time group: use Union-Find to union all people in meetings at this time. Then mark anyone in a group with the secret-keeper as infected. Repeat until no new infections.',
  timeComplexity: 'O(m * α(n) + n) where m=meetings, α=inverse Ackermann',
  spaceComplexity: 'O(n) for Union-Find parent array',
  gotcha: 'Must process meetings chronologically and handle simultaneous meetings correctly. A person learns the secret during minute t only if someone in their meeting group knew it before minute t. The timing simulation is the crux.',
  faangNote: 'Amazon 8/10, Google 6/10. Tests Union-Find + simulation combined. Challenge: ensuring correct timing propagation. State: "I simulate time, at each minute union all meeting participants, then propagate secrets through connected components."',
  alternateApproaches: [
    { technique: 'Pure DFS with adjacency list', tradeoff: 'Build adjacency list of people (meetings define edges). DFS from person 0 to find all reachable people. Requires careful ordering of meetings by time.', complexity: 'O(m + n) time, O(n + m) space' }
  ]
},

'LC_3108': {
  leetcode: 3108, title: 'Minimum Cost Walk in Weighted Graph', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-cost-walk-in-weighted-graph-with-regular-edges/',
  templateRefs: ['P5'], tags: ['graph','shortest-path','dijkstra','weighted-graph','bitwise-operations','state-compression'],
  keyInsight: 'Graph with both costs and bitwise operations. Use Dijkstra with state = (node, bitmask of edge types used so far). Bitmask tracks which edge types have been traversed — certain combinations unlock cost reductions. Find shortest path from source to destination with optimal bitmask.',
  shrinkTrigger: 'Dijkstra with state (node, bitmask). Priority: (cost, node, mask). For each neighbor via edge with type t: newMask = mask | (1 << t). newCost = cost + compute_edge_cost(type, mask, newMask). Update if (node, newMask) not visited with lower cost.',
  timeComplexity: 'O((V * 2^k) log (V * 2^k)) where k=edge types (k ≤ 16)',
  spaceComplexity: 'O(V * 2^k) for visited states',
  gotcha: 'The bitmask represents edge types traversed, not nodes visited. Different bitmasks represent different states even on the same node. State-based Dijkstra requires careful visited set management — (node, mask) pairs, not just nodes.',
  faangNote: 'Google 8/10. Advanced variant of Dijkstra with state compression. Tests understanding that state ≠ just (node). Lead with: "I use Dijkstra with state (node, bitmask of edge types). Different bitmasks on the same node are different states."',
  alternateApproaches: []
},

'LC_3123': {
  leetcode: 3123, title: 'Find Edges in Shortest Paths', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/find-edges-in-shortest-paths/',
  templateRefs: ['P5'], tags: ['graph','dijkstra','shortest-path','weighted-graph','path-reconstruction','edge-classification'],
  keyInsight: 'Find all edges that lie on ANY shortest path from source to target. Two-pass approach: (1) Dijkstra from source, (2) Dijkstra from target (on reverse graph). Edge (u,v,w) is on a shortest path if dist_from_source[u] + w + dist_from_target[v] == dist_from_source[target].',
  shrinkTrigger: 'dijkstra(source) → dist_s[]. dijkstra_reverse(target) → dist_t[]. For each edge (u,v,w): if dist_s[u] + w + dist_t[v] == dist_s[target]: edge is on a shortest path. Collect all such edges.',
  timeComplexity: 'O((V + E) log V) for two Dijkstra runs',
  spaceComplexity: 'O(V + E)',
  gotcha: 'Must compute distances from source and from target (in reverse graph). The condition dist_s[u] + w + dist_t[v] == dist_s[target] captures all edges contributing to ANY shortest path (not just one).',
  faangNote: 'Google 8/10. Tests Dijkstra mastery and edge-path analysis. Challenge: recognizing that you need distances from both endpoints. State: "I run Dijkstra twice — from source and from target — then identify edges where dist_s[u] + weight + dist_t[v] equals the shortest path length."',
  alternateApproaches: []
},

'LC_752': {
  leetcode: 752, title: 'Open the Lock', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/open-the-lock/',
  templateRefs: ['P1'], tags: ['graph','bfs','implicit-graph','state-transformation','shortest-path','circular-state'],
  keyInsight: 'Lock state is a 4-digit combination (0000-9999). Each transition turns one wheel ±1 (circular: 9→0, 0→9). BFS finds shortest sequence of moves. Deadends are "blocked" states. Key: generate next states by turning each wheel — 8 transitions per state.',
  shrinkTrigger: 'queue = ["0000"]. visited = {"0000"}. While queue: if state in deadends: skip. If state == target: return moves. For each wheel and direction (±1): generate next state. If not visited: enqueue.',
  timeComplexity: 'O(10^4 * 8) = O(1) bounded by number of lock states × neighbors per state',
  spaceComplexity: 'O(10^4) = O(1) for visited set',
  gotcha: 'Circular arithmetic: turning down from 0 goes to 9; turning up from 9 goes to 0. Deadends can be skipped entirely (prune the search). Multiple BFS calls possible if deadends block certain paths — no need, single BFS with pruning is sufficient.',
  faangNote: 'Amazon 7/10, Meta 6/10. Classic implicit graph BFS. Lead with: "This is an implicit graph where lock states are nodes. Each move generates up to 8 next states. BFS finds the shortest sequence."',
  alternateApproaches: [
    { technique: 'Bidirectional BFS', tradeoff: 'Start from both "0000" and target, meet in the middle. Reduces search space but adds complexity.', complexity: 'O(10^4 * 8) time, O(10^4) space' }
  ]
},

'LC_310': {
  leetcode: 310, title: 'Minimum Height Trees', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-height-trees/',
  templateRefs: ['P1','P4'], tags: ['graph','topological-sort','tree','bfs','leaf-removal','undirected-graph'],
  keyInsight: 'For an undirected tree, find nodes that minimize tree height when used as root. Key: height is minimized when the root is central. Iteratively remove leaf nodes (degree 1) using topological sort / BFS. The last 1-2 remaining nodes are optimal roots.',
  shrinkTrigger: 'Build adjacency list. degree[v] = degree count. queue = [leaves with degree 1]. While queue has > 2 nodes: for each leaf: remove neighbors from degree; new leaves enter queue. Return remaining nodes.',
  timeComplexity: 'O(V)',
  spaceComplexity: 'O(V)',
  gotcha: 'Only last 1 or 2 nodes remain — they are the optimal roots. Removing leaves layer-by-layer (topological peeling) finds the tree center. Incorrect approaches: rooting at each node and computing height (O(V²)) or using diameter (more complex).',
  faangNote: 'Google 7/10, Amazon 6/10. Tests topological thinking on trees. Challenge: recognizing the leaf-removal pattern. State: "Iteratively removing leaf nodes peels to the tree center. The final 1-2 nodes are optimal roots."',
  alternateApproaches: []
},

'LC_514': {
  leetcode: 514, title: 'Freedom Trail', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/freedom-trail/',
  templateRefs: ['P7'], tags: ['graph','bfs','dynamic-programming','shortest-path','circular-state','position-tracking'],
  keyInsight: 'Spin dial to spell word character-by-character. State = (word index, dial position). Find minimum spins to reach each next character\'s position on the dial. BFS explores all ways to reach each character, tracking minimum spin distance. DP prevents redundant computation.',
  shrinkTrigger: 'memo = {}. dfs(word_idx, dial_pos): if word_idx == len(word): return 0. if (word_idx, dial_pos) in memo: return memo[(word_idx, dial_pos)]. Find all positions of word[word_idx] on dial. For each position: spin_dist = min circular distance from dial_pos. result = min(spin_dist + 1 + dfs(word_idx+1, new_pos)). Memoize and return.',
  timeComplexity: 'O(V * n * m) where V=word length, n=dial size, m=occurrences per character',
  spaceComplexity: 'O(V * n) for memoization',
  gotcha: 'Circular distance calculation: both clockwise and counter-clockwise are valid. min((target - current) % n, (current - target) % n). State = (word index, dial position) — requires careful DP indexing.',
  faangNote: 'Google 7/10. Tests BFS/DP on a custom state space. Challenge: minimizing the search and recognizing circular distance trade-offs.',
  alternateApproaches: []
},

'LC_2285': {
  leetcode: 2285, title: 'Maximum Total Importance of Roads', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/maximum-total-importance-of-roads/',
  templateRefs: ['P2'], tags: ['graph','degree-analysis','greedy','connected-components','mst-variant'],
  keyInsight: 'Assign importance values (1 to n) to cities to maximize total road importance (sum of u importance + v importance for each road). Greedy: assign higher importance to cities with higher degree (more roads). The sum is importance[u] * degree[u] summed over all cities. Maximize by sorting cities by degree.',
  shrinkTrigger: 'degree[city] = count of roads. Sort cities by degree ascending. importance[i] = i+1 (1-indexed). result = sum over all roads (u,v): importance[u] + importance[v].',
  timeComplexity: 'O(E + V log V) for computing degrees and sorting',
  spaceComplexity: 'O(V)',
  gotcha: 'Greedy is optimal: higher-degree cities contribute to more roads, so assigning them higher importance maximizes total. No need to try permutations.',
  faangNote: 'Google 6/10. Tests greedy reasoning on graph optimization. Lead with: "Higher-degree cities contribute to more roads. Assign higher importance values to them."',
  alternateApproaches: []
},

'LC_2192': {
  leetcode: 2192, title: 'All Ancestors of a Node in a DAG', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/all-ancestors-of-a-node-in-a-dag/',
  templateRefs: ['P2','P4'], tags: ['graph','dfs','topological-sort','dag','reachability','transitive-closure'],
  keyInsight: 'Find all ancestors (nodes that can reach) each node in a DAG. Reverse the graph: ancestors of node u = all nodes that can reach u in the original graph = all nodes u can reach in the reversed graph. DFS/BFS from each node in reversed graph to find reachable nodes.',
  shrinkTrigger: 'reversed_graph = reverse adjacency list. ancestors[u] = set(). For each node u: DFS(u) in reversed graph → find all reachable nodes. ancestors[v].add(u) for each reachable node v. Return sorted ancestors for each node.',
  timeComplexity: 'O(V * (V + E)) for V DFS traversals',
  spaceComplexity: 'O(V + E) for reversed graph',
  gotcha: 'Reversing the graph is the key insight. Ancestors of u in the original graph = nodes reachable from u in the reversed graph. Must sort ancestors lists before returning.',
  faangNote: 'Google 7/10, Amazon 6/10. Tests DAG properties and graph reversal insight. Lead with: "I reverse the graph — now ancestors of u = nodes that can reach u in the reversed graph."',
  alternateApproaches: []
},

'LC_2392': {
  leetcode: 2392, title: 'Build a Matrix With Conditions', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/build-a-matrix-with-conditions/',
  templateRefs: ['P4'], tags: ['graph','topological-sort','dag','two-constraints','ordering'],
  keyInsight: 'Two DAGs specify constraints: element k1 must come before k2 in row order, element k3 must come before k4 in column order. Use topological sort on each DAG independently to get row ordering and column ordering. If either DAG has a cycle, no solution exists. Place element k at (row_pos[k], col_pos[k]).',
  shrinkTrigger: 'Topological sort on rowConditions → row_pos[k]. If cycle: return []. Topological sort on colConditions → col_pos[k]. If cycle: return []. matrix[row_pos[k]][col_pos[k]] = k. Return matrix.',
  timeComplexity: 'O(n + m) where n=vertices, m=edges',
  spaceComplexity: 'O(n²) for matrix + O(n + m) for graph',
  gotcha: 'Two independent topological sorts — each must succeed. Cycles in either DAG mean no solution. Placing elements using independent row and column positions ensures both constraints are satisfied.',
  faangNote: 'Google 8/10. Tests topological sort on TWO independent constraints. Challenge: recognizing that row and column orderings can be determined separately.',
  alternateApproaches: []
},

'LC_1334': {
  leetcode: 1334, title: 'Find the City With the Smallest Number of Neighbors at a Threshold Distance', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance/',
  templateRefs: ['P5'], tags: ['graph','floyd-warshall','shortest-path','weighted-graph','all-pairs'],
  keyInsight: 'Find city with minimum number of neighbors within a distance threshold. Use Floyd-Warshall to compute all-pairs shortest paths. For each city, count neighbors within threshold. Return the city with the smallest count (break ties by largest index).',
  shrinkTrigger: 'Floyd-Warshall computes dist[i][j]. For each city i: count neighbors j where dist[i][j] <= threshold. Track city with minimum count.',
  timeComplexity: 'O(n³) for Floyd-Warshall',
  spaceComplexity: 'O(n²)',
  gotcha: 'Must break ties by largest city index (return the highest-indexed city if there\'s a tie). Floyd-Warshall is suitable for V ≤ 500 in this problem.',
  faangNote: 'Google 6/10, Amazon 5/10. Standard all-pairs shortest path application. Straightforward Floyd-Warshall + threshold counting.',
  alternateApproaches: [
    { technique: 'Dijkstra from each city', tradeoff: 'Run Dijkstra V times. Same O(V² log V) asymptotic (usually worse than O(V³) for this V range).', complexity: 'O(V² log V)' }
  ]
},

'LC_2045': {
  leetcode: 2045, title: 'Second Minimum Time to Reach Destination', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/second-minimum-time-to-reach-destination/',
  templateRefs: ['P1','P5'], tags: ['graph','bfs','shortest-path','weighted-graph','state-tracking','second-minimum'],
  keyInsight: 'Find the second-minimum time to reach destination from source. Key: track both minimum and second-minimum time to each node. Transitions: wait at a node (if arriving before a certain phase) or move to neighbor. BFS explores states (node, time, visit_count). When reaching destination the second time, return that time.',
  shrinkTrigger: 'dist = [infinity, infinity] for each node (min and second-min). queue = [(node=0, time=0, count=0)]. While queue: if node==destination: increment reach_count; if reach_count==2: return time. For each neighbor: next_time = time + time_of_edge. If next_time < dist[neighbor][0]: update; enqueue. Else if next_time < dist[neighbor][1]: update; enqueue.',
  timeComplexity: 'O(V + E) for BFS with limited states',
  spaceComplexity: 'O(V)',
  gotcha: 'The second visit to the destination is the answer — not just any second path. Tracking dist[node][0] and dist[node][1] (min and second-min) is the crux.',
  faangNote: 'Google 8/10. Unique variant: finding the SECOND-minimum path instead of the minimum. Tests creative state-space design.',
  alternateApproaches: []
},

'LC_2699': {
  leetcode: 2699, title: 'Modify Graph Edge Weights', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/modify-graph-edge-weights/',
  templateRefs: ['P5'], tags: ['graph','dijkstra','shortest-path','edge-modification','constraint-satisfaction'],
  keyInsight: 'Modify edge weights (from 1 to arbitrary) such that shortest path from source to target equals exactly target distance. Binary search or two-pass Dijkstra: first compute shortest path with original weights (capped at target). If shortest < target, modify an edge on the path to increase shortest path to exactly target. If shortest == target, any modification works (set unused edges to large values).',
  shrinkTrigger: 'Two Dijkstra passes: first with weights capped at target. If shortest > target: impossible (return []). If shortest == target: set all "1" edges to target+1 (or keep as-is). If shortest < target: find an edge on the shortest path with weight<target+1; increase it to bridge the gap.',
  timeComplexity: 'O((V + E) log V) for two Dijkstra runs',
  spaceComplexity: 'O(V + E)',
  gotcha: 'Modifying a single edge on the shortest path can increase the overall shortest path distance. The key: find an edge (u, v) on the shortest path where dist[source][u] + modified_weight + dist[v][target] >= target, then set modified_weight appropriately.',
  faangNote: 'Google 8/10. Tests Dijkstra + constraint engineering. Challenge: determining which edge to modify and how much.',
  alternateApproaches: []
},

'LC_2924': {
  leetcode: 2924, title: 'Find Champion II', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/find-champion-ii/',
  templateRefs: ['P2','P4'], tags: ['graph','graph-analysis','in-degree','directed-graph','single-source'],
  keyInsight: 'Find the champion: a team that beats all others directly or transitively. Use in-degree analysis: if a team has in-degree 0, it could be a champion (no other team beats it). Then BFS/DFS to verify this team can reach all other teams (meaning it beats them transitively). If no in-degree-0 node or if it cannot reach all others, no champion exists.',
  shrinkTrigger: 'in_degree[team] = count of teams that beat it. If > 1 team has in_degree 0: no unique champion. If 1 team has in_degree 0: candidate. BFS from candidate: if reaches all n teams: return candidate. Else: no champion.',
  timeComplexity: 'O(V + E)',
  spaceComplexity: 'O(V + E)',
  gotcha: 'A champion must beat all others either directly or through a chain of wins. In-degree 0 is necessary but the BFS check for reachability ensures it\'s also sufficient. If multiple in-degree-0 teams, there\'s no champion.',
  faangNote: 'Amazon 6/10. Tests graph reasoning and in-degree properties. Lead with: "A champion has in-degree 0 and can reach all other nodes via directed edges."',
  alternateApproaches: []
},

'LC_3243': {
  leetcode: 3243, title: 'Shortest Distance After Road Addition Queries I', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/shortest-distance-after-road-addition-queries-i/',
  templateRefs: ['P1'], tags: ['graph','bfs','incremental-graph','shortest-path','query-processing'],
  keyInsight: 'Start with sequential nodes (0→1→2→...→n-1). Each query adds a shortcut edge. After each edge addition, compute shortest path from 0 to n-1. BFS is O(V + E) per query. For large numbers of queries, this is the standard approach (no better way without more advanced structures).',
  shrinkTrigger: 'graph = [[i+1] for i in range(n-1)] (sequential edges). For each query (u, v): graph[u].append(v). BFS(0, n-1) → shortest distance. Append to results.',
  timeComplexity: 'O(m * (V + E)) where m=queries',
  spaceComplexity: 'O(V + E)',
  gotcha: 'With each query, the shortest path can only decrease (new shortcuts). BFS finds the shortest in the updated graph. No need for caching or sophisticated data structures if m is small.',
  faangNote: 'Google 7/10. Tests incremental graph updates and repeated BFS. Not overly complex — straightforward BFS on a growing graph.',
  alternateApproaches: []
},

'LC_2290': {
  leetcode: 2290, title: 'Minimum Obstacle Removal to Reach Corner', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-obstacle-removal-to-reach-corner/',
  templateRefs: ['P1'], tags: ['graph','0-1-bfs','deque','shortest-path','grid','obstacle-removal'],
  keyInsight: '0-1 BFS: moving to empty cell costs 0, moving to obstacle costs 1. Use deque: add 0-cost moves to front, 1-cost moves to back. This maintains shortest path in O(V + E) without a priority queue. Deque-based BFS finds minimum obstacles to remove.',
  shrinkTrigger: 'deque. Start: deque.appendleft((0, 0, 0)) (cost=0). While deque: (cost, r, c) = deque.popleft(). If (r,c) == destination: return cost. For each neighbor: if empty: appendleft((cost, ...)); if obstacle: append((cost+1, ...)).',
  timeComplexity: 'O(m * n)',
  spaceComplexity: 'O(m * n)',
  gotcha: 'Deque 0-1 BFS: move to empty cells are 0-cost (add to front), moves to obstacles are 1-cost (add to back). This order ensures optimal substructure without Dijkstra\'s priority queue overhead.',
  faangNote: 'Google 8/10, Amazon 7/10. Tests 0-1 BFS mastery — a critical optimization over standard Dijkstra for weighted graphs with only {0, 1} weights. Lead with: "0-1 BFS with a deque finds the shortest path in O(V + E) without a priority queue."',
  alternateApproaches: [
    { technique: 'Dijkstra', tradeoff: 'Works but O((V + E) log V) is slower than 0-1 BFS O(V + E).', complexity: 'O((V + E) log V)' }
  ]
},

'LC_2577': {
  leetcode: 2577, title: 'Minimum Time to Visit a Cell In a Grid', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-time-to-visit-a-cell-in-a-grid/',
  templateRefs: ['P1'], tags: ['graph','dijkstra','shortest-path','grid','parity','time-constraint'],
  keyInsight: 'Time constraint: can move to (r, c) only at time when (row time + col time) % 2 matches arrival parity. Dijkstra with parity tracking: state = (row, col, time, arrival_parity). Skip arrival if parity mismatches. Key insight: if row/col speeds are too high, may be impossible to reach any neighbor (return -1).',
  shrinkTrigger: 'Dijkstra with state (r, c, time). For each neighbor: arrival_time = time + 1. If arrival_time is valid parity for that neighbor: update. Parity must match (time + 1) vs (row_speed + col_speed).',
  timeComplexity: 'O(m * n * log(m*n))',
  spaceComplexity: 'O(m * n)',
  gotcha: 'Parity constraint is the challenge: you can only move to a cell at certain times due to speed parity. If you cannot move anywhere from the start, return -1 immediately.',
  faangNote: 'Google 8/10. Teaches Dijkstra with parity constraints — less common variant. Challenge: recognizing the parity rule and implementing it correctly.',
  alternateApproaches: []
},

'LC_3419': {
  leetcode: 3419, title: 'Minimize the Maximum of Subtree Sums', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimize-the-maximum-of-subtree-sums-after-removing-edges/',
  templateRefs: ['P2'], tags: ['graph','tree-dfs','subtree-sum','edge-removal','minimization','binary-search'],
  keyInsight: 'Remove k edges from a tree to create k+1 subtrees. Minimize the maximum subtree sum. Binary search on the answer: for a candidate max sum S, check if we can remove k edges such that all resulting subtrees have sum ≤ S. Use tree DFS to compute subtree sums and count removable edges (subtree sum ≥ S).',
  shrinkTrigger: 'Binary search on max sum. For candidate S: DFS to compute subtree sums. Count subtrees with sum ≥ S (removable edges). If count >= k: S is feasible. Find minimum feasible S.',
  timeComplexity: 'O(n log(sum)) for binary search on answer + O(n) DFS per check',
  spaceComplexity: 'O(n) for DFS recursion',
  gotcha: 'Binary search on the answer (max subtree sum) not on the number of edges. A subtree with sum ≥ S can be separated by removing the edge leading to it.',
  faangNote: 'Google 8/10. Tests binary search on answer + tree DFS. Challenge: setting up the binary search bounds correctly.',
  alternateApproaches: []
},

'LC_1368': {
  leetcode: 1368, title: 'Minimum Cost to Make at Least One Valid Path in a Grid', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/minimum-cost-to-make-at-least-one-valid-path-in-a-grid/',
  templateRefs: ['P1'], tags: ['graph','0-1-bfs','deque','grid','direction-change','cost-minimization'],
  keyInsight: '0-1 BFS on a grid where moving in the cell\'s specified direction costs 0, moving in other directions costs 1. Deque: free moves to front, paid moves to back. Find minimum cost to reach bottom-right corner.',
  shrinkTrigger: 'deque. Start: (0, 0, cost=0). For each cell: if direction matches neighbor: cost 0, add to front; else cost 1, add to back. BFS to bottom-right.',
  timeComplexity: 'O(m * n)',
  spaceComplexity: 'O(m * n)',
  gotcha: '0-1 BFS leverages the two-cost structure. Dijkstra works but 0-1 BFS is more elegant and faster.',
  faangNote: 'Google 8/10, Amazon 7/10. Another 0-1 BFS problem on a grid — reinforces the deque-based approach.',
  alternateApproaches: []
},

'LC_1462': {
  leetcode: 1462, title: 'Course Schedule IV', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/course-schedule-iv/',
  templateRefs: ['P4'], tags: ['graph','topological-sort','transitive-closure','dag','reachability','dynamic-programming'],
  keyInsight: 'Check if multiple prerequisite pairs exist in a DAG (course prerequisites). Precompute reachability: can(u, v) = can u reach v? Use topological sort + DP: for each pair, check if v is reachable from u via DFS/BFS. Or precompute transitive closure with Floyd-Warshall variant (V ≤ 100, n ≤ 10,000).',
  shrinkTrigger: 'Topological sort to verify DAG. For each query (u, v): BFS/DFS from u → check if v is reachable. Or precompute reachability[u][v] = true if u reaches v. Answer query with reachability[u][v].',
  timeComplexity: 'O(V + E) for topological sort; O(q * (V + E)) for q queries with per-query BFS; O(V² + E * V) for precomputed reachability',
  spaceComplexity: 'O(V + E + q)' ,
  gotcha: 'Direct prerequisite is not enough — need transitive prerequisite (indirect paths count). Precomputation trades space for faster queries.',
  faangNote: 'Amazon 7/10, Google 6/10. Tests transitive closure in DAGs. Lead with: "I verify the DAG is acyclic, then for each query precompute or check reachability on-demand."',
  alternateApproaches: [
    { technique: 'BFS per query (no precomputation)', tradeoff: 'Simpler code but slower for many queries.', complexity: 'O(V + E + q * (V + E)) time' }
  ]
},

'LC_2658': {
  leetcode: 2658, title: 'Maximum Number of Fish in a Grid', difficulty: 'Medium', status: 'Pending',
  link: 'https://leetcode.com/problems/maximum-number-of-fish-in-a-grid/',
  templateRefs: ['P2'], tags: ['graph','dfs','connected-components','grid','sum-maximization','implicit-graph'],
  keyInsight: 'Grid where cells are "land" (0), "water with fish" (>0), or "obstacles". Find the maximum sum of fish in a single water-connected component (treating water as an implicit graph with 4-directional adjacency). DFS from each unvisited water cell to find its component sum. Track the maximum.',
  shrinkTrigger: 'max_fish = 0. For each (r, c): if grid[r][c] > 0 and unvisited: fish_sum = dfs(r, c). max_fish = max(max_fish, fish_sum). dfs(r, c): marks visited; returns grid[r][c] + sum of dfs on unvisited water neighbors.',
  timeComplexity: 'O(m * n)',
  spaceComplexity: 'O(m * n)',
  gotcha: 'DFS marks cells as visited (in-place: set to 0 or use separate visited array). Only water cells (>0) are traversable; land (0) and obstacles are boundaries.',
  faangNote: 'Amazon 6/10, Meta 5/10. Standard connected-components grid problem. Lead with: "I treat water as an implicit graph. DFS from each unvisited water cell sums the entire connected region."',
  alternateApproaches: [
    { technique: 'Union-Find', tradeoff: 'Union adjacent water cells. Count components and sum fish per component. Slightly more overhead but equivalent complexity.', complexity: 'O(m * n * α(m*n))' }
  ]
},

'LC_2127': {
  leetcode: 2127, title: 'Maximum Employees to Be Invited to a Meeting', difficulty: 'Hard', status: 'Pending',
  link: 'https://leetcode.com/problems/maximum-employees-to-be-invited-to-a-meeting/',
  templateRefs: ['P9'], tags: ['graph','cycle-detection','dfs','tree','directed-graph','complex-graph-analysis'],
  keyInsight: 'Graph of preferences: each person prefers to sit next to one person. Find the maximum people who can sit together (must form a valid configuration with cycles and trees). Key: a cycle can be extended by adding employees in tree-like chains hanging off the cycle. Find the largest cycle or the sum of two 2-cycles with trees extending from them.',
  shrinkTrigger: 'Build preference graph. DFS to detect all cycles and their lengths. For each 2-cycle (mutual preference): extend with BFS/DFS of the reverse graph to find max tree depth from each person. For larger cycles: the cycle itself is the answer. Return max(cycle_lengths, 2-cycles + trees).',
  timeComplexity: 'O(V + E)',
  spaceComplexity: 'O(V + E)',
  gotcha: 'This problem requires careful cycle analysis. Two special cases: (1) single cycles of length > 2 contribute their size, (2) two 2-cycles can be connected by reverse-graph trees, adding their depths. Most complex graph problem in the set.',
  faangNote: 'Google 9/10. Hardest graph problem on most lists. Tests cycle detection, tree analysis, and complex reasoning. Challenge: correctly identifying the two 2-cycle + tree configuration and maximizing their sum.',
  alternateApproaches: []
}
