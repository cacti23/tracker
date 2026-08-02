# 🗃️ Memoization Mechanics: Turning "Memoize" Into Actual Code

**Use when:** [[02-recursion-backtracking-dp-decision-map]] Q5 told you "same state repeats via different paths → memoize" — this note is the "now what do I actually write" that follows.

> Added to close a gap: the decision map names memoization as a step but never shows the mechanics. Everything else in this folder was derived from your own notes; this one fills a hole those notes pointed at but didn't cover — worth knowing the provenance if you're re-reading this months from now.

---

## 🔑 The one question: what IS "the state"?

> **The cache key = every parameter that, if unchanged, guarantees the same return value.**

Not "every parameter" blindly — only the ones that actually vary the outcome. A `path`/`res` accumulator passed along for bookkeeping is NOT part of the state (see [[03-void-vs-return-value]] — accumulator-style params belong to backtracking-shaped `void` functions, which don't get memoized anyway).

```typescript
function dfs(idx: number, sum: number): number { ... }
// state = (idx, sum) — BOTH determine the answer → cache key = `${idx},${sum}` or nested map[idx][sum]
```

---

## 🗺️ Map vs Array — pick by key shape

| Key shape | Use | Why |
|---|---|---|
| Small fixed range, e.g. `idx: 0..n`, `sum: 0..target` | **2D array** `dp[idx][sum]` | O(1) access, no hashing overhead, pre-sized |
| Sparse / huge range (e.g. `sum` can go negative, or key is a string/tuple not naturally array-indexable) | **Map** keyed by a composed string, e.g. `` `${idx}-${sum}` `` | Array would be mostly empty or need an offset hack |
| Key is inherently a small bitmask (`visited` as `0..2^n`) | **Array** `dp[mask]` | Bitmask IS a dense integer range — perfect array index |

**Gut check:** can you bound every state variable to a small, non-negative, contiguous range? Yes → array. No → Map.

---

## 🔝 Top-down (memoized recursion) vs 🔽 Bottom-up (tabulation)

| | Top-down | Bottom-up |
|---|---|---|
| Write style | Recursion + cache check at top | Loop, fill array in dependency order |
| Fill order | Automatic (recursion resolves it) | Manual — you must get it right (see [[../dp/01-fill-direction-per-variable]]) |
| Only computes states actually needed? | ✅ Yes | ❌ No — fills the whole table |
| Risk | Stack overflow on deep recursion | Wrong fill direction → reads uninitialized cell |
| Start here when... | prototyping, or the reachable state space is much smaller than the full grid | recursion depth is a concern, or you need O(1) space via row-rolling |

🔑 **Practical default:** write top-down first — it's harder to get the ordering wrong. Convert to bottom-up only if you hit recursion depth limits or need the space optimization.

---

## 🧱 The skeleton (top-down)

```typescript
const memo = new Map<string, number>();   // or: const memo = Array(n).fill(null).map(() => Array(target+1).fill(-1));

function dfs(idx: number, sum: number): number {
  if (baseCase) return baseValue;

  const key = `${idx},${sum}`;
  if (memo.has(key)) return memo.get(key)!;   // 🔑 cache CHECK — before any work

  const result = combine(dfs(idx + 1, sum), dfs(idx + 1, sum + item[idx]));

  memo.set(key, result);                       // 🔑 cache WRITE — before returning
  return result;
}
```

⚠️ **Two most common bugs:**
1. Checking the cache AFTER doing work instead of before → defeats the entire point
2. Building the key from a mutable object (like an array reference) instead of its serialized value → two calls with "equal" state get treated as different keys

---

## 🧠 Anchor

**"State = the parameters that determine the answer, not every parameter in the signature. Bound-able range → array. Unbounded/sparse → Map. Cache-check first, cache-write last, always."**
