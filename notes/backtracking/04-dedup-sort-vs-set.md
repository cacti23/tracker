# 🎯 Backtracking Dedup: Sort-based vs Set-based

**Use when:** the input has duplicate values and you need to avoid generating duplicate results — pick the trick based on whether you're allowed to sort.

Two problems, two different duplicate-avoidance tricks — pick the right one based on **whether you're allowed to sort**.

---

## 1️⃣ Subsets II (LC 90) — array CAN be sorted

✅ **Sort first:**
```typescript
nums.sort((a, b) => a - b);
```

✅ **Skip duplicate at the SAME recursion depth:**
```typescript
if (i > start && nums[i] === nums[i - 1]) continue;
```

🔑 **Why sorting works:**
- Order in the output doesn't matter — it's a set/subset problem
- Sorting groups equal values together → duplicates sit adjacent
- `i > start && nums[i] === nums[i-1]` = "don't re-pick a value you already tried at this branch point"

---

## 2️⃣ Non-decreasing Subsequences (LC 491) — array CANNOT be sorted

✅ **Use a `Set` at EACH recursion level:**
```typescript
const used = new Set<number>();

for (let i = start; i < nums.length; i++) {
    if (used.has(nums[i])) continue;
    used.add(nums[i]);
    // ...recurse
}
```

🔑 **Why we can't sort here:**
- Problem needs subsequences that are non-decreasing **in original index order**
- Sorting would destroy that order → wrong answers
- No "adjacent duplicates" trick available → need an explicit per-level tracker instead

---

## 📊 Side-by-side

| | Subsets II | Non-decreasing Subsequences |
|---|---|---|
| Can sort? | ✅ Yes (order doesn't matter) | ❌ No (order defines validity) |
| Dedup method | Adjacent-check after sort | `Set` per recursion level |
| Why | Sort clusters dupes together | Order must stay original — no free clustering |

---

## 🧠 Memory anchor

> **Can I sort? → compare with neighbor (`i > start && nums[i]===nums[i-1]`)**
> **Can't sort? → track with a `Set`**

Both solve the *same* underlying problem — don't re-explore an already-tried value at the same branching point. They just **detect** "already tried" differently, depending on whether sorting is allowed.

> Related: [[05-bucket-distribution-optimizations]]'s symmetric-skip is a third variant of this same "don't re-explore an already-tried value at this branch point" idea, applied to interchangeable buckets instead of array values.
