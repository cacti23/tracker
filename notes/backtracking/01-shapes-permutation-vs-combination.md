# 🧭 Backtracking Shapes: Permutation vs Combination-family (Pool vs Bucket)

**Use when:** starting a new backtracking problem and need to pick the loop/index structure — the first fork to check, before reaching for dedup or pruning tricks.

**TL;DR:** Subsets & Combinations are order-BLIND (grouping problem) 🎒. Permutations are order-AWARE (arrangement problem) 🔢.

> Related: maps onto [[../dp-backtracking-meta/01-option-consumption-recursion]]'s Shrinking/Full-Reset split — pool (2a below) = Shrinking Scope, bucket (2b) and Permutation = Full-Reset Scope, same idea, different vocabulary.

---

## 🔑 The master question — split by ORDER first

> **Does order matter?**
> - YES → Permutation
> - NO → Combination-family (which then splits into TWO sub-shapes)

---

## 1️⃣ Order matters → Permutation

📌 `permute`

```typescript
for (val = 0; val < n; val++) {
    if (used[val]) continue
    used[val] = true
    place val at this position
    recurse(nextPosition)
    used[val] = false
}
```

- Position advances (`path.length`), fixed sequence
- Loop picks WHICH VALUE — `used[]` actively enforces "no reuse anywhere on my current path"
- `[1,2] ≠ [2,1]` → both are valid, distinct answers

---

## 2️⃣ Order doesn't matter → Combination-family

Two different sub-shapes live here, depending on WHAT the loop is choosing:

### 2a. Choose ITEMS from a pool

📌 `subsets`, `combine`, `combinationSum2`, `combinationSum3`

```typescript
for (i = start; i < n; i++) {
    pick pool[i]
    recurse(i + 1)   // forward-only, never revisit
}
```

- Loop = "which candidate to grab next FROM THE POOL"
- `start` prevents re-picking + prevents reshuffled duplicates
- No separate "fixed thing advancing" — the loop itself IS the advancing mechanism

### 2b. Choose a BUCKET for a fixed item

📌 `distributeCookies`

```typescript
for (bucket = 0; bucket < k; bucket++) {
    place items[idx] into bucket
    recurse(idx + 1)   // item is fixed, always advances
}
```

- `idx` (the item) advances OUTSIDE the loop, fixed sequence — separate from the loop
- Loop = "which bucket" — reuse of a bucket is totally fine (many items → same bucket)
- No `start` needed — nothing to avoid revisiting

🎯 **Pruning insight for THIS shape specifically:** a bucket's running sum only GROWS during one path (monotonic). Once it exceeds your best answer, it can never recover — prune the MOMENT that happens, without waiting for the leaf. See [[05-bucket-distribution-optimizations]] for the full technique set.

---

## 🔗 Why 2a and 2b are genuinely different, even though both are "combination-family"

| | What advances on its own | What the loop chooses | Reuse in the loop? |
|---|---|---|---|
| 2a: pool (subsets/combine) | nothing separate — loop IS the advance | which item | ❌ no, `start` blocks it |
| 2b: bucket (distributeCookies) | `idx` (the item), outside the loop | which bucket | ✅ yes, expected |

**2b and permutation actually SHARE a structural trait** — both have something FIXED advancing outside the loop (item in 2b, position in permutation) — they differ only in whether the loop's choice allows reuse (buckets: yes; values: no, hence `used[]`).

## 🧠 Anchor

**"Order matters → permutation, scan 0..n + used[]. Order doesn't → ask what the loop is choosing: items from a shrinking pool (start, no reuse) or a bucket for a fixed, advancing item (0..k, reuse expected)."**
