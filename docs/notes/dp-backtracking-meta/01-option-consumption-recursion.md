# 🥋 Option-Consumption Recursion

**Use when:** you're staring at a Knapsack/Subsets/Combinations/Permutations-shaped problem and need to pick the loop shape (shrinking `start` vs full-reset `0..n`) — the deep-dive this topic gets, vs. [[02-recursion-backtracking-dp-decision-map]]'s quick pass.

**The pattern behind:** 0/1 & unbounded Knapsack DP · Subsets · Combinations · Permutations

**Goal:** recognize THIS shape fast, so these stop being individually-memorized problems.

*Covers problems where the core question at every step is: "is THIS option still available to me?"*
*Does NOT cover: window/interval problems (`[i,j]` state — Stone Game, Burst Balloons), Two-Sequence DP (LCS/Edit Distance), Tree DP, Grid/Path DP.*

> Related: [[02-recursion-backtracking-dp-decision-map]] for the full 6-question workflow this feeds into. [[../backtracking/01-shapes-permutation-vs-combination]] covers the same Shrinking/Full-Reset split with different vocabulary (pool/bucket/permutation) plus concrete code shapes. [[../backtracking/06-knapsack-01-vs-unbounded-complexity]] for the complexity math behind the bounded/unbounded distinction mentioned below. [[../backtracking/02-pick-skip-vs-for-loop]] reaches the same two code skeletons below through a different lens ("is a half-finished answer valid?").

---

## ⭐ First signal — return type (a HINT, not a hard rule)

> **Asked for a NUMBER/boolean → skip/not-skip is a good DEFAULT to reach for first.**
> **Asked for the ACTUAL combinations/subsets/paths (a list of lists) → for-loop + `path` is the natural fit.**

⚠️ This is a starting habit, not the deciding factor. When there's no reuse involved, skip/take
and for-loop explore the EXACT SAME states — they're the same algorithm, just written two ways. A
number-returning problem CAN be written as a for-loop; a list-returning problem CAN be written
skip/take. If in doubt, the REAL fork is the question below.

---

## 🧠 The ONE question that determines everything else

> **Once I take this option, is it gone FOREVER — or could a LATER, unrelated decision reuse it?**
- Gone forever → **Shrinking Scope**
- Reusable elsewhere, just blocked right now → **Full-Reset Scope**

Answer this in 5 seconds and you already know: the loop shape, the base case shape, and whether
you need `start`/`idx` or a fixed `0..n` range.

---

## 🔒 SHRINKING SCOPE

Loop/recursion bound **grows with depth** — `idx` or `start` only ever moves forward, never back.

**Why it shrinks:** every option here gets **used up**. Once you decide about `nums[i]` — take
it or leave it — that specific `i` is *done, permanently*, for the rest of this branch. The
decision space only ever gets smaller as you go deeper.

> 🎒 Mental model: you're walking down a fixed list, consuming candidates one at a time. Once
> consumed (taken OR skipped), that candidate is gone from the pool for good.

**Skip/Not-Skip** (one item, 2 choices, both land on the SAME next state):
```typescript
function dfs(idx, sum) {
  if (baseCase) return ...;
  const skip = dfs(idx + 1, sum);                  // leave it — idx now permanently behind us
  const take = 1 + dfs(idx + 1, sum + item[idx]);  // take it — bounded: ALSO idx+1
  return combine(skip, take);
}
```

**For-loop with `start`** (n candidates, one chosen per level):
```typescript
function backtrack(start, path) {
  if (baseCase) { results.push([...path]); return; }
  for (let i = start; i < candidates.length; i++) {
    path.push(candidates[i]);
    backtrack(i + 1, path);   // bounded — i off-limits going forward
    path.pop();
  }
}
```

> 🔗 **These are the SAME idea, just compressed:** `for (i = start...)` IS "should I take
> candidate `i`?" tried for every `i` in one sweep, with "skip everything before `i`" baked into
> starting the loop at `start`. Skip/Not-Skip = pick/not-pick for ONE item. For-loop = the same
> yes/no question asked for ALL n remaining candidates, in a loop.

> 🔁 **Unbounded twist:** if the same item CAN be reused, the "take" call stays at the same index
> (`dfs(idx, ...)` or `backtrack(i, path)` instead of `+1`). Scope still never goes *backward* —
> you just don't force it forward on a take. Still shrinking, just a slower shrink.

**Shrinking-scope problems:**

| # | Name | Shape | Bounded/Unbounded |
|---|---|---|---|
| 416 | Partition Equal Subset Sum | Skip/Not-Skip | Bounded |
| 494 | Target Sum | Skip/Not-Skip | Bounded |
| 474 | Ones and Zeroes | Skip/Not-Skip | Bounded |
| 322 | Coin Change | Skip/Not-Skip | Unbounded |
| 139 | Word Break | For-loop (try every cut-end position) | Unbounded |
| 78 | Subsets | For-loop | Bounded |
| 90 | Subsets II | For-loop | Bounded |
| 39 | Combination Sum | For-loop | Unbounded |
| 40 | Combination Sum II | For-loop | Bounded |
| 77 | Combinations | For-loop | Bounded |

---

## 🔄 FULL-RESET SCOPE

Loop bound is a **fixed constant every call** — the "options" are containers being filled, or a
shared board being checked fresh, not candidates being used up.

**Why it resets:** ask — *does taking this option make it unavailable for a completely
different decision later?*
- A **candidate number** in Subsets → yes, using it rules it out → Shrinking.
- A **bucket** in K Equal Sum Subsets → no! Bucket 2 can receive a number on move 1 AND move 5 —
  not "used up" by receiving something once → Full-Reset.
- A **digit 1-9** in Sudoku → not used up globally, only *within this specific row/col/box* —
  every new cell starts the digit-check fresh at 1 → Full-Reset.
- An **index** in Permutations → every position needs *some* unused item, but you check ALL
  positions 0..n again at every level (filtered by `used[]`) — the loop range itself never
  shrinks, only what passes the filter shrinks → Full-Reset.

> 🎒 Mental model: you're not consuming a list — you're filling containers, or checking a shared
> board fresh each time. What blocks a choice is a *temporary, local* condition, not a permanent removal.

```typescript
function backtrack(state) {
  if (baseCase) { results.push([...path]); return; }
  for (let i = 0; i < allOptions.length; i++) {   // ALWAYS 0..n — never `start`
    if (!isValidRightNow(i, state)) continue;       // filtered by CURRENT constraints only
    choose(i);
    backtrack(nextState);
    unchoose(i);                                     // fully available again next call
  }
}
```

**Full-reset-scope problems:**

| # | Name | What resets every call |
|---|---|---|
| 46 | Permutations | index 0..n, filtered by `used[]` |
| 47 | Permutations II | same, + duplicate-skipping |
| 51 | N-Queens | column 0..n, filtered by conflicts |
| 37 | Sudoku Solver | digit 1..9, filtered by row/col/box |
| 698 | Partition to K Equal Sum Subsets | bucket 0..k, filtered by overflow |

---

## 🧭 Quick reference

| | Shrinking | Full-Reset |
|---|---|---|
| Loop bound | grows with depth | fixed constant |
| "Used" option | permanently gone | reusable elsewhere |
| **Gut check** | `idx`/`start` only increases with depth | loop always runs `0..n` regardless of depth |
