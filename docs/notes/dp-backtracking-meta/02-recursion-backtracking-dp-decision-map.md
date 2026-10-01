# 🧭 Recursion / Backtracking / DP: Master Decision Map

**Use when:** you have a new recursion/backtracking/DP problem and need to quickly figure out the state, return type, and loop shape — the default starting workflow.

⚠️ **Scope: covers ~70-80% of DP/backtracking problems** (clean linear state, one index/sum moving forward). Does NOT reliably cover: multi-entity state (two travelers), tree-children-combining logic, or graphs with real cycles — those need extra problem-specific thinking on top of this map. Graphs are a SEPARATE category, only occasionally overlapping.

⚠️ **Known blind spot:** Q3/Q4 below only branch into permutation-style (order matters) or shrinking-scope (order doesn't matter) shapes. They have **no branch for full-reset bucket-filling problems** — N-Queens, Sudoku Solver, K Equal Sum Subsets — where the loop bound is a fixed container/digit/column range, not a shrinking candidate pool. If Q3/Q4 don't produce a sensible answer, stop and check [[01-option-consumption-recursion]]'s Full-Reset Scope section instead — that's the fallback this map doesn't cover.

> Related: [[01-option-consumption-recursion]] (questions 3–4 here are that note's shrinking-vs-full-reset split, reframed). [[03-void-vs-return-value]] (question 2 here, expanded). [[04-memoization-mechanics]] (question 5 here, expanded into actual code).

---

## 🔑 Run these 6 questions, in order, every time

### 1️⃣ What STATE moves forward?
Usually `idx`. Sometimes `sum`, `row/col`, `mask`. Pick the thing that changes as you recurse deeper.

### 2️⃣ Does the PARENT need the CHILD's return value?
| | |
|---|---|
| **YES** | Function **returns a value** — this is DP-shaped |
| **NO** | Function is **`void`** — real answer lives in shared `res`/counter (backtracking-shaped) |

### 3️⃣ Does ORDER matter in the output?
| | |
|---|---|
| **NO** (subsets, combine, combinationSum family) | `for (i=start...)` — pool-style |
| **YES** (permute) | Scan from `0` every time + `used[]` — `start` CANNOT work here |

### 4️⃣ (If order doesn't matter) Is REUSE of the same item allowed?
| | |
|---|---|
| **NO reuse** | `recurse(i+1)` — move forward, never revisit |
| **REUSE allowed** (combinationSum, shoppingOffers) | `recurse(i)` — stay put |

🔑 **Nuance:** if NO reuse is needed, for-loop and pick/skip (binary) are the SAME algorithm — pick whichever's clearer to write. Reuse is the ONLY case that forces for-loop specifically.

### 5️⃣ Does the SAME state repeat via DIFFERENT paths?
| | |
|---|---|
| **YES** (climbStairs, numTrees, cherryPickup) | **Memoize** — this is what makes it "DP," not just recursion. See [[04-memoization-mechanics]] for cache-key shape and array-vs-Map. |
| **NO** (maxSubArray, linear chains) | Memo would be inert — skip it |

### 6️⃣ WHEN is the answer recorded?
| | |
|---|---|
| **Every node, unconditionally** | Push/update at the TOP of the function, before any choices |
| **Only at a specific condition** | Explicit `if` gate (e.g. `path.length===k`, `idx===n`) |

---

## 🧩 Bonus: pool vs bucket vs position (the "for-loop vs pick/skip" shape check)

| Loop is choosing... | Pattern |
|---|---|
| WHICH ITEM from a pool | `for(i=start...)`, forward-only |
| WHERE a FIXED item goes (destination) | loop `0..k`, item advances OUTSIDE the loop, reuse expected |
| WHICH VALUE for a FIXED position | scan `0..n` + `used[]`, no reuse allowed |

---

## ⚠️ Where this map runs out — recognize these as "slow down" signals

- **Multi-entity state** (two simultaneous travelers) → may need a DERIVED reduction to collapse variables (e.g. `col = steps - row`)
- **Tree recursion combining children** (`maxDepth`, `diameterOfBinaryTree`) → map gets you to "return a value," but HOW to combine (sum? max? check-then-combine?) is problem-specific
- **Real graphs with cycles** → `visited` here prevents INFINITE LOOPS, a different job than memoization's "avoid recomputation" — don't conflate the two

---

## 🧠 The one thing to remember

**This map tells you WHICH QUESTIONS to ask, fast. It does not hand you the creative insight for genuinely novel problems — recognizing "this doesn't fit cleanly" is itself the signal to slow down and derive the state/reduction from first principles.**
