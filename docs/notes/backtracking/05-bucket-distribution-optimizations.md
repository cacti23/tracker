# 🍪 Bucket-Distribution Backtracking: The 3 Optimizations

**Use when:** solving `distributeCookies`, `canPartitionKSubsets`, or any "assign items to k interchangeable buckets, minimize/check the max" problem — after you've identified it as [[01-shapes-permutation-vs-combination]]'s 2b bucket shape.

📌 Applies to: `distributeCookies`, `canPartitionKSubsets`, any "assign items to k interchangeable buckets, minimize/check the max" problem.

---

## 1️⃣ Sort descending — fail fast

Place biggest items FIRST. A bucket's running sum only tells the TRUTH once the big contributor is in it — small-first makes doomed branches look "safe" for many wasted steps.

```typescript
cookies.sort((a, b) => b - a);
```

🧠 *Small numbers first = the prune check gets lied to. Big numbers first = truth immediately.*

---

## 2️⃣ Symmetric-skip — tied buckets are interchangeable

Buckets have NO identity — only their current sum matters. If bucket `i` and bucket `i-1` hold the SAME sum, trying both explores an identical (relabeled) outcome. (Same underlying idea as [[04-dedup-sort-vs-set]]'s "don't re-try an already-tried value at this branch point," applied to buckets instead of array values.)

```typescript
if (i > 0 && childCookies[i] === childCookies[i-1]) continue;
```

🧠 *`[5,0,0]` and `[0,5,0]` are the same situation, just relabeled — skip the duplicate.*

⚠️ Special case: an EMPTY bucket that FAILS means every OTHER empty bucket will ALSO fail — use `break` (not `continue`) there specifically, checked AFTER the undo:
```typescript
if (childCookies[i] === 0) break;   // after backtrack failed and undo ran
```

---

## 3️⃣ Prune on exceed — stop doomed branches early

If a bucket already meets/exceeds the best answer found so far, it can only get worse — stop immediately.

```typescript
if (childCookies[i] < minCookies) backtrack(idx + 1);
```

---

## 🎯 Bonus (not always grouped with the "big 3"): incremental max, not `Math.max(...)` rescan

Track `currentMax` as a parameter instead of scanning the whole bucket array at every leaf — O(1) per node instead of O(k).

```typescript
backtrack(idx + 1, Math.max(currentMax, childCookies[i]));
```

---

## 🧠 Anchor

**"Sort (fail fast) + symmetric-skip (no duplicate exploration) + prune-on-exceed (stop doomed branches) — three INDEPENDENT, stackable optimizations. None change worst-case Big-O, but combined they cut real execution dramatically."**
