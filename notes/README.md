# DSA Notes Index

Personal "things I derived" notes, organized by folder. Each note has a `Use when:` line up top — open the file, not just this index, when you need the actual content. This index exists so you can find the right folder/file without opening everything.

Not every note here started as your own writing — one (marked below) was added by Claude to close a gap an existing note pointed at but didn't cover. Provenance matters for a learning journal, so it's flagged rather than blended in silently.

---

## `dp-backtracking-meta/` — cross-cutting decision frameworks (bridges DP and backtracking)

| File | One-line hook |
|---|---|
| `01-option-consumption-recursion.md` | Shrinking scope (candidate used up forever) vs Full-reset scope (bucket/board, reusable) — the deep dive, with LeetCode number tables |
| `02-recursion-backtracking-dp-decision-map.md` | The 6-question workflow to run on any new problem: state → return type → order → reuse → memo → when-recorded |
| `03-void-vs-return-value.md` | Does the caller use the return value? → `void`+shared state (backtracking) vs returns-a-value (DP, required for memo) — applies to both function shape and bounds guards |
| `04-memoization-mechanics.md` | 🤖 *Claude-added.* Cache key shape, array vs Map, top-down vs bottom-up — the "how" that 02's memo step didn't cover |

## `dp/` — DP-specific mechanics

| File | One-line hook |
|---|---|
| `01-fill-direction-per-variable.md` | Tabulation fill order: check EACH variable separately for self-reference, not the whole state at once |
| `02-game-strategy-minimax.md` | Your turn = maximize, opponent's turn = minimize (assume perfect play) |

## `backtracking/` — backtracking-specific shapes and techniques

| File | One-line hook |
|---|---|
| `01-shapes-permutation-vs-combination.md` | Master fork: order matters → permutation; doesn't → pool (start, no reuse) or bucket (idx, reuse expected) |
| `02-pick-skip-vs-for-loop.md` | Is a half-finished answer already valid? No → pick/skip, record at leaf. Yes → for-loop, record everywhere |
| `03-subsets-vs-combinations.md` | Subsets = all sizes, 2ⁿ, record everywhere. Combinations = fixed size k, C(n,k), stop early |
| `04-dedup-sort-vs-set.md` | Can you sort the input? Yes → adjacent-check after sort. No (order is meaningful) → Set per recursion level |
| `05-bucket-distribution-optimizations.md` | 3 stackable speedups for bucket-assignment backtracking: sort descending, symmetric-skip, prune-on-exceed |
| `06-knapsack-01-vs-unbounded-complexity.md` | Why 0/1 knapsack is O(2ⁿ) but unbounded is O(n^depth) — branching factor, not "how many options exist" abstractly |

---

## Cross-folder map (the same idea, different vocabulary)

Some concepts got derived twice, from different angles, on different days — that's not a mistake, each framing is useful on its own, but know they're the same underlying split:

- **Shrinking/Full-Reset** (`dp-backtracking-meta/01`) ≡ **Pool/Bucket/Permutation** (`backtracking/01`) ≡ **half-finished-answer-valid?** (`backtracking/02`) — three lenses on the same "does this loop shrink or stay fixed" question.
- **Void vs returns-value** (`dp-backtracking-meta/03`) is the same fork as decision-map question 2 (`dp-backtracking-meta/02`), just expanded with code.
