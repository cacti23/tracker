# 🔁 ULTIMATE BACKTRACKING CHEATSHEET
## *SDE2/SDE3 FAANG Interview Edition | TypeScript*
### ⭐ OPTIMIZED FOR LC MEDIUM/HARD

---

## 📑 QUICK NAVIGATION

1. [Decision Framework](#1-decision-framework)
2. [Universal Template](#2-universal-backtracking-template)
3. [The 5 Flavors](#3-the-5-backtracking-flavors)
4. [Keyword → Pattern Map](#4-keyword--pattern-map)
5. [Template 1: Subsets](#5-template-1-subsets)
6. [Template 2: Permutations](#6-template-2-permutations)
7. [Template 3: Combinations](#7-template-3-combinations)
8. [Template 4: Grid / Path Search](#8-template-4-grid--path-search)
9. [Template 5: Constraint Satisfaction](#9-template-5-constraint-satisfaction)
10. [Template 6: String Partitioning](#10-template-6-string-partitioning)
11. [Pruning Strategies](#11-pruning-strategies)
12. [Backtracking + Memo Hybrids](#12-backtracking--memo-hybrids)
13. [Complexity Analysis](#13-complexity-analysis)
14. [Top 45 LC Problems Map](#14-top-40-lc-problems-map)
15. [Interview Script](#15-interview-script)
16. [Pre-Interview Rapid Revision](#16-pre-interview-rapid-revision)

---

## 1. DECISION FRAMEWORK

> **Senior Engineer mindset**: Before writing a line of code, classify the problem. Every minute spent here saves 5 minutes of wrong-direction coding.

```
┌──────────────────────────────────────────────────────┐
│ STEP 1: SHOULD I BACKTRACK?                          │
├──────────────────────────────────────────────────────┤
│ ✅ You need ALL solutions / enumerate possibilities  │
│ ✅ You are building solutions incrementally           │
│ ✅ Invalid states can be detected early (pruning)    │
│ ✅ Problem involves: subsets, perms, combos,         │
│    placements, partitions, paths with constraints    │
│                                                      │
│ ❌ You only need ONE optimal answer → try DP/Greedy  │
│ ❌ No ability to prune → plain DFS/BFS               │
│ ❌ Subproblems overlap heavily → Memoized DP         │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ STEP 2: WHAT IS THE CHOICE AT EACH STEP?            │
├──────────────────────────────────────────────────────┤
│ Ask: "At this point in building my solution,         │
│       what options do I have?"                       │
│                                                      │
│ • Include element i or skip it          → Subsets   │
│ • Place element at next open position   → Perms     │
│ • Pick element starting from index i   → Combos     │
│ • Move in 4 directions from cell (r,c)  → Grid path │
│ • Place queen/digit in row/cell         → Constraint │
│ • Cut string at position j              → Partition  │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ STEP 3: WHAT IS THE TERMINATION CONDITION?          │
├──────────────────────────────────────────────────────┤
│ Base case 1 (COLLECT): solution is complete         │
│   → push a copy of current path to results          │
│ Base case 2 (PRUNE): current path is invalid        │
│   → return immediately, undo last choice            │
│                                                      │
│ ⚠️  Always push a COPY: results.push([...path])     │
│     NOT results.push(path)  ← classic bug           │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ STEP 4: WHERE CAN I PRUNE?                          │
├──────────────────────────────────────────────────────┤
│ Good pruning = the difference between TLE and AC    │
│                                                      │
│ • Remaining elements can't satisfy target           │
│ • Current sum already exceeds limit                 │
│ • Duplicate element at same recursion level         │
│ • Cell already visited (grid)                       │
│ • Constraint violated (N-Queens, Sudoku)            │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│ STEP 5: DO I NEED TO MEMOIZE?                       │
├──────────────────────────────────────────────────────┤
│ Only if: same (index, state) pair can be reached    │
│ via DIFFERENT paths with same future potential      │
│ → then add memo Map<string, result>                 │
│                                                      │
│ Pure backtracking: NO memoization needed            │
│ Hybrid (backtracking-style DP): YES, memoize        │
└──────────────────────────────────────────────────────┘
```

---

## 2. UNIVERSAL BACKTRACKING TEMPLATE

```typescript
// THE UNIVERSAL TEMPLATE — memorize this skeleton
function solve(input: any[]): any[][] {
  const results: any[][] = [];
  const path: any[] = [];

  function backtrack(/* state: index, remaining capacity, etc. */) {
    // BASE CASE: solution is complete
    if (/* termination condition */) {
      results.push([...path]);   // ⚠️ COPY, not reference
      return;
    }

    for (const choice of /* choices at this step */) {
      // PRUNE: skip invalid choices early
      if (/* choice is invalid */) continue;

      // CHOOSE
      path.push(choice);
      // mutate state if needed (e.g., mark visited)

      // EXPLORE
      backtrack(/* updated state */);

      // UNCHOOSE (backtrack)
      path.pop();
      // reverse state mutation
    }
  }

  backtrack(/* initial state */);
  return results;
}
```

> **The three words to tattoo on your brain: CHOOSE → EXPLORE → UNCHOOSE**
>
> Every backtracking solution is just these 3 lines in a loop. Your job in the interview
> is to fill in: what are the choices, when do I terminate, and where do I prune.

---

## 3. THE 5 BACKTRACKING FLAVORS

```
FLAVOR              KEY QUESTION                    EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subsets             Include or skip each element?   LC 78, 90
                    (order doesn't matter)

Permutations        Which unused element goes next? LC 46, 47
                    (order matters, use each once)

Combinations        Pick k from n, starting from i  LC 77, 39, 40, 216
                    (order doesn't matter, avoid re-pick)

Grid / Path         Move in 4 dirs, mark visited    LC 79, 212, 200, 130
                    (path on 2D grid)

Constraint          Place item satisfying rules      LC 51, 52, 37
Satisfaction        (N-Queens, Sudoku)

String              Cut at position j if valid       LC 131, 17, 22, 93
Partitioning        (palindromes, IP addrs, parens)
```

> **⭐ THE #1 DECISION — `start` index vs `used[]` array** (memorize this — it picks your template):
> ```
> ORDER DOESN'T MATTER (subsets, combinations) → pass a `start` index,
>   loop `for (i = start; ...)`, recurse with i+1 (or i if reuse allowed).
>   This prevents [1,2] and [2,1] from both appearing.
>
> ORDER MATTERS (permutations) → use a `used[]` boolean array,
>   loop `for (i = 0; ...)`, skip if used[i].
>   This lets every element appear at every position.
> ```
> If you can answer "does order matter?" in 5 seconds, you've already picked the skeleton.

---

## 4. KEYWORD → PATTERN MAP

```
KEYWORD / PHRASE                               → PATTERN              LC EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"all subsets" / "power set"                    → Subsets              78, 90
"all permutations"                             → Permutations          46, 47
"all combinations of k from n"                 → Combinations          77
"combination sum / target sum"                 → Combinations + prune  39, 40, 216
"generate all valid parentheses"               → String partition      22
"palindrome partitioning"                      → String partition      131, 132
"restore IP addresses"                         → String partition      93
"letter combinations of phone number"          → Permutation/Combo     17
"word search in grid"                          → Grid path             79, 212
"number of islands / connected region"         → DFS (not backtrack)   200
"N-Queens"                                     → Constraint satisf.    51, 52
"Sudoku solver"                                → Constraint satisf.    37
"expression add operators"                     → String partition      282
"partition to K equal subsets"                 → Subsets + bitmask     698, 1723
"path exists from source to dest in grid"      → Grid path             490, 62
"word break II (all ways)"                     → String partition      140
"beautiful arrangement"                        → Permutation + prune   526
"combinations with at most / exactly k"        → Combinations          216, 254
"reconstruct itinerary"                        → Graph path backtrack  332
"remove invalid parentheses"                   → String partition + BFS 301
"split array into fibonacci"                   → String partition      842
"maximum length of concatenated str"           → Subsets + check      1239
"find all paths from source to target"         → Graph path backtrack  797
"concatenated words"                           → Trie + backtrack      472
```

---

## 5. TEMPLATE 1: SUBSETS

> **Pattern**: At each index, decide include or skip. Two choices per element → 2^n total.

### 5.1 Basic Subsets — LC 78 (no duplicates)

```typescript
function subsets(nums: number[]): number[][] {
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number): void {
    results.push([...path]);          // collect at EVERY node, not just leaves

    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);             // CHOOSE
      backtrack(i + 1);              // EXPLORE (i+1: each element used once)
      path.pop();                    // UNCHOOSE
    }
  }

  backtrack(0);
  return results;
}
// Time: O(n * 2^n)  Space: O(n) recursion depth
```

### 5.2 Subsets with Duplicates — LC 90

```typescript
function subsetsWithDup(nums: number[]): number[][] {
  nums.sort((a, b) => a - b);        // MUST sort to group duplicates
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number): void {
    results.push([...path]);

    for (let i = start; i < nums.length; i++) {
      // Skip duplicate at same recursion level
      if (i > start && nums[i] === nums[i - 1]) continue;

      path.push(nums[i]);
      backtrack(i + 1);
      path.pop();
    }
  }

  backtrack(0);
  return results;
}
```

> **Key rule for duplicates**: `if (i > start && nums[i] === nums[i-1]) continue`
> - `i > start` (not `i > 0`) means: only skip at THIS level, not globally

### 5.3 Pick / Skip Formulation (the OTHER mental model)

```typescript
// Same result as 5.1, but as an explicit binary CHOICE tree.
// This is the model that generalizes directly to 0/1-knapsack DP.
function subsetsPickSkip(nums: number[]): number[][] {
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(i: number): void {
    if (i === nums.length) {        // leaf: one decision made per element
      results.push([...path]);
      return;
    }
    backtrack(i + 1);               // SKIP nums[i]

    path.push(nums[i]);             // TAKE nums[i]
    backtrack(i + 1);
    path.pop();
  }

  backtrack(0);
  return results;
}
// Two formulations, same answer. for-loop (5.1) collects at every node;
// pick/skip collects only at leaves. Know both — interviewers probe this.
```

### 5.4 Subsets via Bitmask Iteration (no recursion)

```typescript
function subsetsBitmask(nums: number[]): number[][] {
  const n = nums.length;
  const results: number[][] = [];
  for (let mask = 0; mask < (1 << n); mask++) {  // each mask = one subset
    const subset: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(nums[i]);
    }
    results.push(subset);
  }
  return results;
}
// O(n * 2^n), zero recursion. Clean when n <= 20. Mention as an alternative.
```

---

## 6. TEMPLATE 2: PERMUTATIONS

> **Pattern**: At each position, pick any UNUSED element. n! total permutations.

### 6.1 Basic Permutations — LC 46 (no duplicates)

```typescript
function permute(nums: number[]): number[][] {
  const results: number[][] = [];
  const used = new Array(nums.length).fill(false);
  const path: number[] = [];

  function backtrack(): void {
    if (path.length === nums.length) {
      results.push([...path]);
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;         // PRUNE: already in path

      used[i] = true;                // CHOOSE
      path.push(nums[i]);
      backtrack();                   // EXPLORE
      path.pop();                    // UNCHOOSE
      used[i] = false;
    }
  }

  backtrack();
  return results;
}
// Time: O(n * n!)  Space: O(n)
```

### 6.2 Permutations with Duplicates — LC 47

```typescript
function permuteUnique(nums: number[]): number[][] {
  nums.sort((a, b) => a - b);        // sort to group duplicates
  const results: number[][] = [];
  const used = new Array(nums.length).fill(false);
  const path: number[] = [];

  function backtrack(): void {
    if (path.length === nums.length) {
      results.push([...path]);
      return;
    }

    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      // Skip: same value as prev AND prev not used in this level
      // This ensures we only pick duplicates in a fixed order
      if (i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) continue;

      used[i] = true;
      path.push(nums[i]);
      backtrack();
      path.pop();
      used[i] = false;
    }
  }

  backtrack();
  return results;
}
```

> **Duplicate permutation trick**: `i > 0 && nums[i] === nums[i-1] && !used[i-1]`
> - Ensures among identical elements, they are always picked in left-to-right order
> - `!used[i-1]`: prev identical element was NOT chosen (already backtracked) → skip this one

### 6.3 Swap-Based Permutation (space-efficient, no `used` array)

```typescript
function permuteSwap(nums: number[]): number[][] {
  const results: number[][] = [];

  function backtrack(start: number): void {
    if (start === nums.length) {
      results.push([...nums]);
      return;
    }

    for (let i = start; i < nums.length; i++) {
      [nums[start], nums[i]] = [nums[i], nums[start]];   // CHOOSE (swap)
      backtrack(start + 1);                               // EXPLORE
      [nums[start], nums[i]] = [nums[i], nums[start]];   // UNCHOOSE (swap back)
    }
  }

  backtrack(0);
  return results;
}
// ⚠️  Does NOT handle duplicates cleanly — use 6.2 for that
```

---

## 7. TEMPLATE 3: COMBINATIONS

> **Pattern**: Pick k from n, order doesn't matter. Use `start` index to avoid re-picking.

### 7.1 Basic Combinations — LC 77

```typescript
function combine(n: number, k: number): number[][] {
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number): void {
    if (path.length === k) {
      results.push([...path]);
      return;
    }

    // PRUNE: not enough elements remaining to fill k slots
    const remaining = k - path.length;
    for (let i = start; i <= n - remaining + 1; i++) {  // upper bound prune
      path.push(i);
      backtrack(i + 1);
      path.pop();
    }
  }

  backtrack(1);
  return results;
}
```

### 7.2 Combination Sum (reuse allowed) — LC 39

```typescript
function combinationSum(candidates: number[], target: number): number[][] {
  candidates.sort((a, b) => a - b);   // sort enables early termination
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number, remaining: number): void {
    if (remaining === 0) {
      results.push([...path]);
      return;
    }

    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) break;   // PRUNE (sorted → all remaining > target)

      path.push(candidates[i]);
      backtrack(i, remaining - candidates[i]);  // i (not i+1): same element reusable
      path.pop();
    }
  }

  backtrack(0, target);
  return results;
}
// Time: O(n^(T/M)) where T=target, M=min candidate
```

### 7.3 Combination Sum II (no reuse, duplicates in input) — LC 40

```typescript
function combinationSum2(candidates: number[], target: number): number[][] {
  candidates.sort((a, b) => a - b);
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number, remaining: number): void {
    if (remaining === 0) {
      results.push([...path]);
      return;
    }

    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) break;                      // PRUNE: sum exceeded
      if (i > start && candidates[i] === candidates[i - 1]) continue; // PRUNE: duplicates

      path.push(candidates[i]);
      backtrack(i + 1, remaining - candidates[i]);   // i+1: no reuse
      path.pop();
    }
  }

  backtrack(0, target);
  return results;
}
```

### 7.4 Combination Sum III (exactly k numbers, 1-9) — LC 216

```typescript
function combinationSum3(k: number, n: number): number[][] {
  const results: number[][] = [];
  const path: number[] = [];

  function backtrack(start: number, remaining: number): void {
    if (path.length === k && remaining === 0) {
      results.push([...path]);
      return;
    }
    if (path.length === k || remaining <= 0) return;  // PRUNE

    for (let i = start; i <= 9; i++) {
      if (i > remaining) break;   // PRUNE: sorted 1-9
      path.push(i);
      backtrack(i + 1, remaining - i);
      path.pop();
    }
  }

  backtrack(1, n);
  return results;
}
```

---

## 8. TEMPLATE 4: GRID / PATH SEARCH

> **Pattern**: Explore cells in 4 directions, mark visited inline, unmark on backtrack.

### 8.1 Word Search — LC 79

```typescript
function exist(board: string[][], word: string): boolean {
  const rows = board.length, cols = board[0].length;
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  function backtrack(r: number, c: number, idx: number): boolean {
    if (idx === word.length) return true;       // BASE CASE: matched all chars
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (board[r][c] !== word[idx]) return false;
    if (board[r][c] === '#') return false;      // already visited

    const temp = board[r][c];
    board[r][c] = '#';                         // CHOOSE: mark visited IN-PLACE

    for (const [dr, dc] of dirs) {
      if (backtrack(r + dr, c + dc, idx + 1)) return true;  // short-circuit
    }

    board[r][c] = temp;                        // UNCHOOSE: restore
    return false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (backtrack(r, c, 0)) return true;
    }
  }
  return false;
}
// Time: O(rows*cols * 3^L)  (4 dirs, but ≤3 unexplored after step 1)  Space: O(L)
```

### 8.2 Word Search II (multiple words, Trie) — LC 212

```typescript
// Build a Trie, then DFS the board
// Key optimization: delete found words from Trie to avoid re-finding
interface TrieNode {
  children: Map<string, TrieNode>;
  word: string | null;
}

function findWords(board: string[][], words: string[]): string[] {
  // Build Trie
  const root: TrieNode = { children: new Map(), word: null };
  for (const w of words) {
    let node = root;
    for (const ch of w) {
      if (!node.children.has(ch)) node.children.set(ch, { children: new Map(), word: null });
      node = node.children.get(ch)!;
    }
    node.word = w;
  }

  const result: string[] = [];
  const rows = board.length, cols = board[0].length;
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  function dfs(r: number, c: number, node: TrieNode): void {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const ch = board[r][c];
    if (ch === '#' || !node.children.has(ch)) return;

    const next = node.children.get(ch)!;
    if (next.word) {
      result.push(next.word);
      next.word = null;             // avoid duplicate results
    }

    board[r][c] = '#';
    for (const [dr, dc] of dirs) dfs(r + dr, c + dc, next);
    board[r][c] = ch;

    // Prune empty Trie nodes (major optimization)
    if (next.children.size === 0) node.children.delete(ch);
  }

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      dfs(r, c, root);

  return result;
}
```

### 8.3 Find All Paths — LC 797

```typescript
function allPathsSourceTarget(graph: number[][]): number[][] {
  const n = graph.length;
  const results: number[][] = [];
  const path: number[] = [0];   // start at node 0

  function backtrack(node: number): void {
    if (node === n - 1) {
      results.push([...path]);
      return;
    }
    for (const next of graph[node]) {
      path.push(next);
      backtrack(next);
      path.pop();
    }
  }

  backtrack(0);
  return results;
}
// In a DAG: no visited set needed (no cycles)
// In a general graph (cycles possible): add a visited set, mark on enter,
// UNMARK on exit — this is the Hamiltonian-path backtracking shape:
//   visited.add(node); for (next of adj[node]) if(!visited.has(next)) dfs(next);
//   visited.delete(node);   // ← the unmark is what makes it backtracking, not plain DFS
```

### 8.4 Robot Room Cleaner — LC 489 (⭐ Google favorite)

```typescript
// Robot API: move(): boolean, turnLeft(), turnRight(), clean()
// You do NOT get coordinates — track them yourself relative to start.
function cleanRoom(robot: Robot): void {
  const visited = new Set<string>();
  const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];  // up, right, down, left (clockwise)

  function goBack(): void {           // turn 180°, move, turn 180° back to original facing
    robot.turnRight(); robot.turnRight();
    robot.move();
    robot.turnRight(); robot.turnRight();
  }

  function backtrack(row: number, col: number, d: number): void {
    visited.add(`${row},${col}`);
    robot.clean();

    for (let i = 0; i < 4; i++) {                 // try all 4 directions
      const nd = (d + i) % 4;                     // direction robot currently faces
      const nr = row + dirs[nd][0], nc = col + dirs[nd][1];

      if (!visited.has(`${nr},${nc}`) && robot.move()) {
        backtrack(nr, nc, nd);
        goBack();                                 // UNCHOOSE: physically return
      }
      robot.turnRight();                          // rotate to next direction
    }
  }

  backtrack(0, 0, 0);
}
// Key insight: you can't teleport — "backtracking" means physically driving back.
```

### 8.5 Unique Paths III — LC 980 (grid + must visit ALL empty cells)

```typescript
function uniquePathsIII(grid: number[][]): number {
  const rows = grid.length, cols = grid[0].length;
  let empty = 0, startR = 0, startC = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) empty++;
      else if (grid[r][c] === 1) { startR = r; startC = c; }
    }

  let paths = 0;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  function backtrack(r: number, c: number, remaining: number): void {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] === -1) return;
    if (grid[r][c] === 2) {
      if (remaining === 0) paths++;     // reached end AND covered every empty cell
      return;
    }

    grid[r][c] = -1;                    // CHOOSE: mark visited
    for (const [dr, dc] of dirs) backtrack(r + dr, c + dc, remaining - 1);
    grid[r][c] = 0;                     // UNCHOOSE: restore
  }

  backtrack(startR, startC, empty + 1); // +1 counts the start cell itself
  return paths;
}
```

### 8.6 Reconstruct Itinerary — LC 332 (⚠️ NOT actually backtracking)

```typescript
// LESSON: this LOOKS like backtracking but naive backtracking TLEs.
// Correct answer = Hierholzer's algorithm for an Eulerian path (use each EDGE once).
function findItinerary(tickets: string[][]): string[] {
  const graph = new Map<string, string[]>();
  for (const [from, to] of tickets) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push(to);
  }
  for (const dests of graph.values()) dests.sort((a, b) => b.localeCompare(a)); // pop smallest

  const route: string[] = [];
  function dfs(airport: string): void {
    const dests = graph.get(airport);
    while (dests && dests.length) dfs(dests.pop()!);  // consume edges greedily
    route.push(airport);                              // post-order push
  }

  dfs('JFK');
  return route.reverse();
}
// Interview signal: recognizing "use every edge once" → Eulerian, NOT brute backtracking.
```

### 8.7 Word Squares — LC 425 (Trie / prefix-map + backtracking)

```typescript
// A word square reads the same across rows and down columns: square[i][j] === square[j][i].
// Place words row by row; the word at row `r` is forced to start with a known prefix
// (column r of the rows already placed). A prefix→words map gives candidates in O(1).
function wordSquares(words: string[]): string[][] {
  const n = words[0].length;

  const prefixMap = new Map<string, string[]>();   // every prefix → words having it
  for (const w of words) {
    for (let i = 0; i <= w.length; i++) {
      const pre = w.slice(0, i);
      if (!prefixMap.has(pre)) prefixMap.set(pre, []);
      prefixMap.get(pre)!.push(w);
    }
  }

  const results: string[][] = [];
  const square: string[] = [];

  function backtrack(row: number): void {
    if (row === n) {
      results.push([...square]);
      return;
    }
    // Row `row` must start with column `row` of every row already placed.
    let prefix = '';
    for (let r = 0; r < row; r++) prefix += square[r][row];

    for (const cand of (prefixMap.get(prefix) ?? [])) {  // PRUNE: only valid prefixes
      square.push(cand);          // CHOOSE
      backtrack(row + 1);         // EXPLORE
      square.pop();               // UNCHOOSE
    }
  }

  for (const w of words) {        // any word can seed row 0
    square.push(w);
    backtrack(1);
    square.pop();
  }
  return results;
}
// The prefix-map is what bounds the branching — without it this is hopeless.
```

### 8.8 Word Ladder II — LC 126 (BFS layering + backtracking reconstruction)

```typescript
// Two-phase Hard: (1) BFS level-by-level to find shortest distance AND record every
// parent on a shortest path, then (2) backtrack over those parents to emit ALL paths.
function findLadders(beginWord: string, endWord: string, wordList: string[]): string[][] {
  const dict = new Set(wordList);
  const results: string[][] = [];
  if (!dict.has(endWord)) return results;

  const parents = new Map<string, string[]>();      // word → words that reach it one step earlier
  let current = new Set<string>([beginWord]);
  const visited = new Set<string>([beginWord]);
  let found = false;

  while (current.size > 0 && !found) {
    const next = new Set<string>();
    for (const word of current) {
      for (let i = 0; i < word.length; i++) {
        for (let c = 97; c <= 122; c++) {            // try 'a'..'z' at each position
          const cand = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
          if (!dict.has(cand) || visited.has(cand)) continue;
          if (!parents.has(cand)) parents.set(cand, []);
          parents.get(cand)!.push(word);             // record edge
          next.add(cand);
          if (cand === endWord) found = true;
        }
      }
    }
    for (const w of next) visited.add(w);  // mark AFTER the level → keeps all same-level parents
    current = next;
  }

  // Phase 2: backtrack from endWord up the parent links, reverse at the base.
  const path: string[] = [endWord];
  function backtrack(word: string): void {
    if (word === beginWord) {
      results.push([...path].reverse());
      return;
    }
    for (const parent of (parents.get(word) ?? [])) {
      path.push(parent);
      backtrack(parent);
      path.pop();
    }
  }

  if (found) backtrack(endWord);
  return results;
}
// Why mark visited per-level (not per-node): a word can have multiple shortest-path
// parents in the SAME layer — marking too early drops valid paths.
```

---

## 9. TEMPLATE 5: CONSTRAINT SATISFACTION

> **Pattern**: Place items one row/cell at a time. Validate constraints before placing.

### 9.1 N-Queens — LC 51

```typescript
function solveNQueens(n: number): string[][] {
  const results: string[][] = [];
  // Track which columns and diagonals are occupied
  const cols = new Set<number>();
  const diag1 = new Set<number>();  // row - col (top-left to bottom-right)
  const diag2 = new Set<number>();  // row + col (top-right to bottom-left)
  const board: number[] = [];       // board[row] = col where queen is placed

  function backtrack(row: number): void {
    if (row === n) {
      // Build string representation
      results.push(board.map(col =>
        '.'.repeat(col) + 'Q' + '.'.repeat(n - col - 1)
      ));
      return;
    }

    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue; // PRUNE

      cols.add(col); diag1.add(row - col); diag2.add(row + col);  // CHOOSE
      board.push(col);
      backtrack(row + 1);                                           // EXPLORE
      board.pop();
      cols.delete(col); diag1.delete(row - col); diag2.delete(row + col); // UNCHOOSE
    }
  }

  backtrack(0);
  return results;
}
// Time: O(n!)  Space: O(n)
```

### 9.2 N-Queens II (count only) — LC 52

```typescript
function totalNQueens(n: number): number {
  let count = 0;
  const cols = new Set<number>(), diag1 = new Set<number>(), diag2 = new Set<number>();

  function backtrack(row: number): void {
    if (row === n) { count++; return; }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row - col) || diag2.has(row + col)) continue;
      cols.add(col); diag1.add(row - col); diag2.add(row + col);
      backtrack(row + 1);
      cols.delete(col); diag1.delete(row - col); diag2.delete(row + col);
    }
  }

  backtrack(0);
  return count;
}
```

### 9.3 Sudoku Solver — LC 37

```typescript
function solveSudoku(board: string[][]): void {
  // Precompute which values are used in each row/col/box
  const rowUsed = Array.from({ length: 9 }, () => new Set<number>());
  const colUsed = Array.from({ length: 9 }, () => new Set<number>());
  const boxUsed = Array.from({ length: 9 }, () => new Set<number>());

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== '.') {
        const val = parseInt(board[r][c]);
        const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        rowUsed[r].add(val); colUsed[c].add(val); boxUsed[box].add(val);
      }
    }
  }

  function backtrack(): boolean {
    // Find next empty cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== '.') continue;

        const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        for (let val = 1; val <= 9; val++) {
          if (rowUsed[r].has(val) || colUsed[c].has(val) || boxUsed[box].has(val)) continue;

          // CHOOSE
          board[r][c] = String(val);
          rowUsed[r].add(val); colUsed[c].add(val); boxUsed[box].add(val);

          if (backtrack()) return true;  // EXPLORE

          // UNCHOOSE
          board[r][c] = '.';
          rowUsed[r].delete(val); colUsed[c].delete(val); boxUsed[box].delete(val);
        }
        return false;  // no valid digit for this cell → backtrack
      }
    }
    return true;  // all cells filled
  }

  backtrack();
}
// Time: O(9^m) where m = number of empty cells
```

### 9.4 N-Queens via Bitmask (⭐ SDE3 "I know the optimal" signal)

```typescript
// Same logic as 9.2 but O(1) bit-ops instead of Set lookups — the fastest approach.
function totalNQueensBitmask(n: number): number {
  let count = 0;
  const full = (1 << n) - 1;        // n low bits set = all columns

  function backtrack(cols: number, diag1: number, diag2: number): void {
    if (cols === full) { count++; return; }   // every column filled → valid board

    let avail = full & ~(cols | diag1 | diag2); // 1-bits = safe columns this row
    while (avail) {
      const pos = avail & (-avail);   // isolate lowest set bit (the column to try)
      avail ^= pos;                   // remove it from candidates
      // diag1 shifts left, diag2 shifts right as we descend one row
      backtrack(cols | pos, (diag1 | pos) << 1, (diag2 | pos) >> 1);
    }
  }

  backtrack(0, 0, 0);
  return count;
}
// Time: O(n!) worst case but with tiny constants. Space: O(n) stack.
```

---

## 10. TEMPLATE 6: STRING PARTITIONING

> **Pattern**: At each position, try all valid cuts. Recurse on the remaining suffix.

### 10.1 Palindrome Partitioning — LC 131

```typescript
function partition(s: string): string[][] {
  const results: string[][] = [];
  const path: string[] = [];
  const n = s.length;

  // Precompute palindrome check with DP (O(n^2) preprocessing)
  const isPalin = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i; j < n; j++) {
      if (s[i] === s[j] && (j - i <= 2 || isPalin[i + 1][j - 1])) {
        isPalin[i][j] = true;
      }
    }
  }

  function backtrack(start: number): void {
    if (start === n) {
      results.push([...path]);
      return;
    }

    for (let end = start; end < n; end++) {
      if (!isPalin[start][end]) continue;  // PRUNE: not a palindrome

      path.push(s.slice(start, end + 1));  // CHOOSE
      backtrack(end + 1);                  // EXPLORE
      path.pop();                          // UNCHOOSE
    }
  }

  backtrack(0);
  return results;
}
// Time: O(n * 2^n)  Space: O(n^2) for isPalin table
```

### 10.2 Generate Parentheses — LC 22

```typescript
function generateParenthesis(n: number): string[] {
  const results: string[] = [];
  const path: string[] = [];

  function backtrack(open: number, close: number): void {
    if (path.length === 2 * n) {
      results.push(path.join(''));
      return;
    }

    if (open < n) {                // can still add open
      path.push('(');
      backtrack(open + 1, close);
      path.pop();
    }
    if (close < open) {            // can close only if more opens exist
      path.push(')');
      backtrack(open, close + 1);
      path.pop();
    }
  }

  backtrack(0, 0);
  return results;
}
// Time: O(4^n / sqrt(n))  Catalan number
```

### 10.3 Letter Combinations — LC 17

```typescript
function letterCombinations(digits: string): string[] {
  if (!digits.length) return [];
  const map: Record<string, string> = {
    '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl',
    '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz'
  };
  const results: string[] = [];
  const path: string[] = [];

  function backtrack(idx: number): void {
    if (idx === digits.length) {
      results.push(path.join(''));
      return;
    }
    for (const ch of map[digits[idx]]) {
      path.push(ch);
      backtrack(idx + 1);
      path.pop();
    }
  }

  backtrack(0);
  return results;
}
```

### 10.4 Restore IP Addresses — LC 93

```typescript
function restoreIpAddresses(s: string): string[] {
  const results: string[] = [];
  const path: string[] = [];

  function backtrack(start: number): void {
    if (path.length === 4 && start === s.length) {
      results.push(path.join('.'));
      return;
    }
    if (path.length === 4 || start === s.length) return;

    for (let len = 1; len <= 3; len++) {
      if (start + len > s.length) break;
      const seg = s.slice(start, start + len);
      if (seg.length > 1 && seg[0] === '0') break;  // PRUNE: leading zero
      if (parseInt(seg) > 255) break;               // PRUNE: > 255

      path.push(seg);
      backtrack(start + len);
      path.pop();
    }
  }

  backtrack(0);
  return results;
}
```

### 10.5 Expression Add Operators — LC 282

```typescript
function addOperators(num: string, target: number): string[] {
  const results: string[] = [];

  function backtrack(idx: number, expr: string, value: number, prev: number): void {
    if (idx === num.length) {
      if (value === target) results.push(expr);
      return;
    }

    for (let len = 1; len <= num.length - idx; len++) {
      const seg = num.slice(idx, idx + len);
      if (seg.length > 1 && seg[0] === '0') break;   // no leading zeros
      const cur = parseInt(seg);

      if (idx === 0) {
        backtrack(len, seg, cur, cur);                // first operand, no operator
      } else {
        backtrack(idx + len, expr + '+' + seg, value + cur, cur);
        backtrack(idx + len, expr + '-' + seg, value - cur, -cur);
        // Multiplication: undo the previous term, re-add (prev * cur)
        backtrack(idx + len, expr + '*' + seg, value - prev + prev * cur, prev * cur);
      }
    }
  }

  backtrack(0, '', 0, 0);
  return results;
}
// The "prev" trick for multiplication is a classic interview question
```

### 10.6 Remove Invalid Parentheses — LC 301 (Hard ⭐)

```typescript
// Step 1: count the MINIMUM removals needed (left/right surplus).
// Step 2: backtrack trying remove-or-keep for each char, only within that budget.
function removeInvalidParentheses(s: string): string[] {
  let lRem = 0, rRem = 0;            // minimum '(' and ')' that must be removed
  for (const ch of s) {
    if (ch === '(') lRem++;
    else if (ch === ')') { if (lRem > 0) lRem--; else rRem++; }
  }

  const results = new Set<string>();

  function backtrack(idx: number, l: number, r: number, open: number, path: string): void {
    if (idx === s.length) {
      if (l === 0 && r === 0 && open === 0) results.add(path);  // exact budget spent + balanced
      return;
    }
    const ch = s[idx];

    // Option 1: REMOVE this char (only a paren, only if budget remains)
    if (ch === '(' && l > 0) backtrack(idx + 1, l - 1, r, open, path);
    if (ch === ')' && r > 0) backtrack(idx + 1, l, r - 1, open, path);

    // Option 2: KEEP this char
    if (ch === '(') backtrack(idx + 1, l, r, open + 1, path + ch);
    else if (ch === ')') {
      if (open > 0) backtrack(idx + 1, l, r, open - 1, path + ch);  // only if it can match
    } else {
      backtrack(idx + 1, l, r, open, path + ch);                   // letters always kept
    }
  }

  backtrack(0, lRem, rRem, 0, '');
  return [...results];
}
// Computing the removal budget first is what bounds the search → no TLE.
```

---

## 11. PRUNING STRATEGIES

> **Pruning is what separates a working backtracker from a fast one. This is where Hard LC problems are won or lost.**

```
PRUNING TECHNIQUE          HOW TO APPLY                          USED IN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Early termination       if (sum > target) break (sorted arr)  LC 39, 40, 216
   via sorted input        Sort + break is O(1) check per node

2. Feasibility check       Not enough items remaining to fill k   LC 77
   (upper bound on loop)   i <= n - (k - path.length) + 1

3. Duplicate skip          i > start && arr[i] === arr[i-1]       LC 40, 90, 47
   (same level, sorted)    → continue (skip same value at level)

4. Constraint sets         Sets for row/col/diag/box              LC 51, 37
   (O(1) validity check)   → avoid O(n) scan per placement

5. Visited mask            board[r][c] = '#' in-place             LC 79, 212
   (inline for grids)      → O(1) and restores on backtrack

6. Pruning dead subtrees   If remaining candidates sum < target    LC 39
   (lower bound)           → break early

7. Trie pruning            Delete exhausted Trie branches         LC 212
   (for word problems)     → avoids re-exploring dead paths

8. Symmetry breaking       Only consider canonical orderings       LC 47
                           e.g., always pick duplicates left→right

9. Count-based pruning     if (remaining cells < remaining words)  LC 51
                           → return early

10. Memoization (hybrid)   If same (idx, state) reached multiple   LC 698, 140
                           times → cache results                   (see §12)
```

### 11.1 Pruning Code Patterns

```typescript
// PATTERN A: sorted + break (most common)
candidates.sort((a, b) => a - b);
for (let i = start; i < candidates.length; i++) {
  if (candidates[i] > remaining) break;   // all further are also > remaining
  // ...
}

// PATTERN B: feasibility upper bound (combination)
for (let i = start; i <= n - (k - path.length) + 1; i++) {
  // Only loop while enough elements remain to reach k
}

// PATTERN C: duplicate skip (sorted)
for (let i = start; i < arr.length; i++) {
  if (i > start && arr[i] === arr[i - 1]) continue;
  // ...
}

// PATTERN D: constraint sets for O(1) validity
const rowUsed = new Set<number>();
if (!rowUsed.has(val)) {
  rowUsed.add(val);
  backtrack(row + 1);
  rowUsed.delete(val);
}
```

---

## 12. BACKTRACKING + MEMO HYBRIDS

> **When to memoize**: If the SAME subproblem (same arguments) can be reached via MULTIPLE different paths, and the answer is always the same regardless of path taken → cache it.

```
PURE BACKTRACKING             vs          MEMOIZED BACKTRACKING (= top-down DP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No repeated subproblems             Subproblems repeat across paths
Each path is unique                 Different paths → same future state
Can't memoize (path carries state)  Future depends only on (idx, state)
Examples: LC 46, 78, 51, 37         Examples: LC 139, 140, 698
```

### 12.1 Word Break II — LC 140 (Backtracking + Memo)

```typescript
function wordBreak(s: string, wordDict: string[]): string[] {
  const wordSet = new Set(wordDict);
  const memo = new Map<number, string[]>();

  function backtrack(start: number): string[] {
    if (memo.has(start)) return memo.get(start)!;
    if (start === s.length) return [''];   // base: empty suffix = one valid split

    const results: string[] = [];
    for (let end = start + 1; end <= s.length; end++) {
      const word = s.slice(start, end);
      if (!wordSet.has(word)) continue;

      const suffixResults = backtrack(end);
      for (const suffix of suffixResults) {
        results.push(suffix ? word + ' ' + suffix : word);
      }
    }

    memo.set(start, results);   // MEMOIZE: same start → same results
    return results;
  }

  return backtrack(0);
}
// Without memo: O(2^n). With memo: O(n^2 * 2^n) output-bound but subproblems O(n^2).
```

### 12.2 Partition to K Equal Subsets — LC 698 (bucket-fill — the expected answer)

```typescript
// PRIMARY APPROACH: fill k buckets one element at a time. The symmetry-break
// pruning (skip empty buckets) is what turns this from TLE into AC.
function canPartitionKSubsets(nums: number[], k: number): boolean {
  const total = nums.reduce((a, b) => a + b, 0);
  if (total % k !== 0) return false;
  const target = total / k;

  nums.sort((a, b) => b - a);            // descending: place big items first (prune sooner)
  if (nums[0] > target) return false;

  const buckets = new Array(k).fill(0);

  function backtrack(idx: number): boolean {
    if (idx === nums.length) return true;  // every item placed → all buckets == target

    for (let b = 0; b < k; b++) {
      if (buckets[b] + nums[idx] > target) continue;

      buckets[b] += nums[idx];             // CHOOSE
      if (backtrack(idx + 1)) return true; // EXPLORE
      buckets[b] -= nums[idx];             // UNCHOOSE

      // ⭐ SYMMETRY-BREAK: if this bucket was empty, all other empty buckets
      // are identical — trying them gives the same failure. Stop here.
      if (buckets[b] === 0) break;
    }
    return false;
  }

  return backtrack(0);
}
// Same template solves LC 473 (Matchsticks → k=4) and LC 1655.
```

> **Bitmask + memo variant**: when you prefer DP framing, define `dp[mask] = true`
> if the chosen subset (bits in `mask`) can be split into complete buckets. The partial
> bucket fill is `sum(mask) % target`, so it's **fully determined by `mask`** — key the
> memo on `mask` ALONE (a `mask*1000+sum` key risks collisions). `O(n·2^n)` states.

### 12.3 When Memoization Does NOT Help

```typescript
// LC 46 Permutations: path [1,2,_] and path [2,1,_] both need element 3 next
// BUT the future valid completions differ per path (no overlap).
// Memoization on just `index` won't work — need full path state.
// → Pure backtracking is correct here. Don't memoize.
```

---

## 13. COMPLEXITY ANALYSIS

> **How to calculate backtracking complexity**: model as a tree. Count nodes × work per node.

```
PROBLEM TYPE           TIME COMPLEXITY        SPACE (excl. output)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subsets (n elements)   O(n × 2^n)             O(n) recursion depth
Permutations (n)       O(n × n!)              O(n)
Combinations (n,k)     O(k × C(n,k))          O(k)
Combo Sum (no dup)     O(n^(T/M))             O(T/M) depth
Grid Word Search       O(m×n × 4^L)           O(L) where L=word len
N-Queens (n)           O(n!)                  O(n)
Sudoku (m empty cells) O(9^m)                 O(m)
Palindrome Partition   O(n × 2^n)             O(n^2) for DP table
```

### 13.1 The Branching Factor Model

```
Time = (# leaves) × (work to build each leaf)
     = (branching factor)^depth × depth

For subsets: branching=2 (include/skip), depth=n → 2^n leaves × O(n) = O(n×2^n)
For combos:  branching≈n, depth=k → C(n,k) leaves × O(k) = O(k×C(n,k))
For perms:   branching=n at depth 0, n-1 at depth 1... → n! leaves × O(n)

INTERVIEW TIP: State the tree model first, then derive complexity.
"The recursion tree has branching factor b and depth d,
 giving O(b^d) nodes with O(d) work per node → O(d × b^d)."
```

---

## 14. TOP 40 LC PROBLEMS MAP

```
#    PROBLEM                              PATTERN              DIFFICULTY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBSETS
78   Subsets                              Subsets              Medium ⭐
90   Subsets II                           Subsets + dedup      Medium ⭐
1239 Max Length of Concatenated Str       Subsets + check      Medium

PERMUTATIONS
46   Permutations                         Permutations         Medium ⭐
47   Permutations II                      Perms + dedup        Medium ⭐
31   Next Permutation                     Math (not backtrack) Medium
60   Permutation Sequence                 Math / pruning       Hard
526  Beautiful Arrangement                Perms + prune        Medium

COMBINATIONS
77   Combinations                         Combinations         Medium ⭐
39   Combination Sum                      Combo + reuse        Medium ⭐
40   Combination Sum II                   Combo no reuse+dedup Medium ⭐
216  Combination Sum III                  Combo bounded        Medium ⭐
254  Factor Combinations                  Combo (factors)      Medium

STRING PARTITION
22   Generate Parentheses                 String partition     Medium ⭐
17   Letter Combinations                  String partition     Medium ⭐
131  Palindrome Partitioning              Partition + DP       Medium ⭐
93   Restore IP Addresses                 Partition + prune    Medium ⭐
282  Expression Add Operators             Partition + math     Hard ⭐
842  Split Array into Fibonacci           Partition            Medium
140  Word Break II                        Partition + memo     Hard ⭐

GRID / PATH
79   Word Search                          Grid path            Medium ⭐
212  Word Search II                       Grid path + Trie     Hard ⭐
489  Robot Room Cleaner                   Grid + relative dir  Hard ⭐⭐
980  Unique Paths III                     Grid + visit-all     Hard ⭐
490  The Maze                             Grid path (BFS/DFS)  Medium
797  All Paths Source to Target           Graph path           Medium ⭐
332  Reconstruct Itinerary                Eulerian (Hierholzer) Hard ⭐
425  Word Squares                         Trie + backtrack     Hard

CONSTRAINT SATISFACTION
51   N-Queens                             Constraint           Hard ⭐⭐
52   N-Queens II (count)                  Constraint           Hard ⭐
37   Sudoku Solver                        Constraint           Hard ⭐⭐

HYBRID: BACKTRACKING + MEMO/BITMASK/BUCKET-FILL
698  Partition to K Equal Subsets         Bucket-fill / memo   Medium ⭐
473  Matchsticks to Square                Bucket-fill (k=4)    Medium ⭐
1655 Distribute Repeating Integers        Bucket-fill + count  Hard ⭐
1723 Find Minimum Time to Finish Jobs     BT + bitmask         Hard ⭐
301  Remove Invalid Parentheses           BT + removal budget  Hard ⭐
126  Word Ladder II                       BFS + backtrack      Hard ⭐
```

---

## 15. INTERVIEW SCRIPT

> **What to say out loud to signal SDE3-level thinking**

### 15.1 Problem Recognition (first 2 minutes)

```
"This asks for ALL [subsets/permutations/valid arrangements], not just one optimal.
 That signals backtracking — exhaustive search with pruning.

 My choice at each step is [include element i / pick next unused / cut at position j].
 I'll terminate when [path length = n / sum = target / all cells filled].

 Key pruning opportunities I see:
  1. [sort + break when sum exceeds target]
  2. [skip duplicate at same level]
  3. [constraint sets for O(1) validity check]"
```

### 15.2 State Definition

```
"My backtrack function signature will be:
  backtrack(start: number, remaining: number) for combinations
  backtrack(row: number) for N-Queens / Sudoku
  backtrack(idx: number, pathStr: string) for string partition

The key invariant: at each call, path contains the choices made so far,
and we're building from position `start` onward."
```

### 15.3 Complexity

```
"The recursion tree has branching factor [b] and max depth [d].
 That gives [b^d] leaves, with O(d) work to record each leaf.
 Time: O(d × b^d). Space: O(d) for the call stack, plus O(output size)."
```

### 15.4 Brain Freeze Recovery

```
Step 1: Write the template (choose/explore/unchoose) — always works.
Step 2: Fill in termination condition first.
Step 3: Fill in one choice branch, test mentally on a small example.
Step 4: Add pruning after the basic version is working.
```

---

## 16. PRE-INTERVIEW RAPID REVISION

> **Scan this 5 minutes before your interview**

```
THE 3 THINGS TO ALWAYS DO:
  1. push([...path])  ← copy, not reference
  2. sort input first ← enables pruning and dedup
  3. undo state after recursion ← restore board[r][c], unmark visited

PICK YOUR SKELETON IN 5 SECONDS — "does order matter?":
  NO  (subsets/combos) → `start` index, loop from start, recurse i+1 (or i if reuse).
  YES (permutations)   → `used[]` array, loop from 0, skip used[i].

THE 3 PRUNING PATTERNS:
  A. if (candidates[i] > remaining) break   ← sorted + exceeded
  B. if (i > start && arr[i] === arr[i-1]) continue ← same-level dedup
  C. if (cols.has(col) || diag1.has(...)) continue  ← constraint check
  D. bucket-fill (698/473): if (buckets[b] === 0) break ← skip symmetric empty buckets

SUBSETS vs COMBINATIONS vs PERMUTATIONS:
  Subsets:       collect at every node. start=i+1. 2^n.
  Combinations:  collect at leaf only (length === k). start=i+1. C(n,k).
  Combo Sum:     collect at leaf (sum === 0). start=i (reuse) or i+1. n^(T/M).
  Permutations:  collect at leaf (length === n). iterate all with `used[]`. n!.

N-QUEENS:
  3 sets: cols, diag1 (row-col), diag2 (row+col). One queen per row.

SUDOKU:
  Find next empty cell, try 1-9, check row/col/box sets. Return false to backtrack.

WORD SEARCH:
  board[r][c] = '#' to mark visited, restore after recursion.

PALINDROME PARTITION:
  Precompute isPalin[i][j] in O(n^2). Then backtrack on suffix.

MEMO TRIGGER:
  If same (idx, state) can be reached via different paths → memoize.
  If path itself is part of state (permutations) → don't memoize.

COMPLEXITY MODEL:
  branches^depth × depth = total time.
  Subsets: 2^n × n. Perms: n! × n. Combos: C(n,k) × k.
```

---

*Backtracking Cheat Sheet | SDE2/SDE3 FAANG Edition | TypeScript*
