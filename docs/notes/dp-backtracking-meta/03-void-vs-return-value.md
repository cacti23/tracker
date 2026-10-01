# 🔁 Void vs Return-Value Recursion (and the bounds-guard it implies)

**Use when:** deciding whether a recursive function should be `void` or should `return` a value — and, once decided, where an out-of-bounds/edge check belongs (before the call, or inside as a base case).

> Related: [[02-recursion-backtracking-dp-decision-map]] question 2 (same fork, as one of six checks).

## 🔑 The one test — applies at BOTH the function level and the guard level

> **Does the CALLER use this call's return value to COMPUTE something (add it, compare it, combine it — min/max/sum)?**
> - YES → function returns a value (DP-shaped) → any bounds guard inside it must also return a value: a **sentinel** that can't win
> - NO → function is `void`, real answer lives in shared state (`res`/counter — backtracking-shaped) → bounds guard goes **before** the call, no sentinel needed

---

## 1️⃣ Returns a value → DP-shaped

- Goal: compute THE answer for this state; caller needs it to build its OWN answer
- Every return is load-bearing — no "explore and discard"
- **Required for memoization**: the function's result must depend ONLY on its parameters, which is why DP-style functions can't lean on a shared mutable "best" the way plain backtracking does

```typescript
function solve(state): number {
    if (base case) return baseValue;
    return combine(solve(nextState1), solve(nextState2), ...);
}
```
📌 `climbStairs`, `shoppingOffers` (memoized), `cherryPickup`

**Bounds guard, same shape → guard INSIDE with a sentinel:**
```typescript
function dfs(row, col): number {
    if (col < 0 || col >= n) return Infinity;   // sentinel — can never win a Math.min
    ...
    best = Math.min(best, dfs(row+1, col+dc));
}
```
📌 `minFallingPathSum`, `dungeonGame` — sentinel is `Infinity` for min, `-Infinity` for max, `0` for sum.

---

## 2️⃣ `void` → backtracking-shaped

- Goal: explore a space, collect ALL results (or check existence) via side effects
- Return value (if any) only signals "stop searching" — never feeds a computation

```typescript
function backtrack(...): void {
    if (base case) { res.push(...); return; }
    for (...) { choose; backtrack(...); un-choose; }
}
```
📌 `subsets`, `permute`, `combinationSum2`, `solveNQueens`

**Bounds guard, same shape → guard BEFORE calling:**
```typescript
function backtrack(row, col): void {
    ...
    if (nr >= 0 && nr < m && nc >= 0 && nc < n) {   // guard BEFORE — nothing to preserve
        backtrack(nr, nc);
    }
}
```
📌 `exist()`, `getMaximumGold` — calling anyway would just return immediately with no effect, so skip it before the call instead.

---

## 🎯 Quick check

| | Feeds `min`/`max`/sum? | Function shape | Guard placement |
|---|---|---|---|
| `minFallingPathSum`, `dungeonGame` | ✅ Yes | Returns value | Inside, sentinel return |
| `exist()`, `getMaximumGold` | ❌ No, `void` | Side-effect only | Before the call |

## 🧠 Anchor

**"Value feeds a computation → call it anyway, return a sentinel that can't win. Void function → check bounds BEFORE calling, nothing to preserve. Same test, two spots: the whole function, and any guard inside it."**
