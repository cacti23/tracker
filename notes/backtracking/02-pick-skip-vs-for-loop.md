# 🌳 Pick/Skip vs 🔁 For-loop

**Use when:** deciding whether to write a problem as binary pick/skip recursion or as a for-loop over candidates — and where to record the answer.

## The one question
**Does a half-finished answer already count as valid?**

---

## 🌳 Pick/Skip
- Half-finished answer valid? ❌ No
- Record result at: leaf only (`index === n`)
- "Skip" costs a recursive call? Yes
- Recursion depth: always exactly `n`
- Used for: knapsack, subset-sum (need total), full assignments

## 🔁 For-loop
- Half-finished answer valid? ✅ Yes
- Record result at: every node
- "Skip" costs a recursive call? No — loop moving forward IS the skip
- Recursion depth: varies (0 to n)
- Used for: subsets, combinations, combination-sum

---

## Pick/skip skeleton
```typescript
function backtrack(i: number, cur: State) {
  if (i === n) { record(cur); return; }  // only valid when ALL decided
  backtrack(i + 1, cur);                  // skip
  backtrack(i + 1, cur + el[i]);          // take
}
```

## For-loop skeleton
```typescript
function backtrack(start: number, cur: State) {
  record(cur);                            // valid right now, always
  for (let i = start; i < n; i++) {
    cur.push(el[i]);
    backtrack(i + 1, cur);
    cur.pop();
  }
}
```

---

## 🧠 Gut check
**"If I stopped right now, is this a legit answer?"**
→ No → 🌳 pick/skip
→ Yes → 🔁 for-loop

⚡ Same Big-O either way — for-loop just skips wasted stack frames.

> Applied to a concrete case: [[03-subsets-vs-combinations]] (subsets = record-everywhere, combinations = record-and-stop-at-k).
