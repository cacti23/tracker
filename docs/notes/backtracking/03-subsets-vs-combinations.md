# 🚪 Subsets vs 🎯 Combinations

**Use when:** you know it's a for-loop, pool-style problem ([[01-shapes-permutation-vs-combination]] 2a) and need to know whether to record at every node or stop at a fixed size.

**The one-line hook:** Subsets = combinations of every size (0 to n), all merged together.

> Built on [[02-pick-skip-vs-for-loop]]'s record-at-leaf vs record-everywhere distinction — this is that rule applied to a concrete pair of problems.

---

## 🚪 Subsets
- Every element gets its own yes/no vote — in or out
- Size varies: can be 0, 1, 2 ... all the way to n
- Total count: **2ⁿ**
- Code style: pick/skip → record only at the leaf (every path is valid)
- No target size → can't stop early, must explore everything

## 🎯 Combinations
- Pick exactly **k** elements, sweep forward, never revisit
- Size is FIXED at k — nothing else counts
- Total count: **C(n, k)**
- Code style: for-loop → record AND STOP once size == k
- Fixed target size → free early pruning

---

## 🧠 Why combinations prunes early and subsets doesn't
- Combinations has a target size k → once `current.length === k`, stop immediately, no need to recurse further
- Subsets has no target size → every stopping point is a valid answer → must keep exploring, record at every node

---

## ⚡ Quick recall trigger
- See "all subsets" → 🚪 pick/skip, record everywhere
- See "choose k" → 🎯 for-loop, record + stop at size k
