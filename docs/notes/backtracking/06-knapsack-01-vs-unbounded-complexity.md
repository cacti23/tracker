# 🎯 0/1 Knapsack vs Unbounded Knapsack — Why Branching Differs

**Use when:** estimating the time complexity of a knapsack-shaped recursion, or explaining why an unbounded variant is so much slower than the bounded one.

## 🔑 One-line rule

> **Item-by-item, move on regardless of choice → branching = 2 (0/1 knapsack)**
> **Slot-by-slot, reuse allowed → branching = n (unbounded knapsack)**

---

## 1️⃣ 0/1 Knapsack (each item used at most once)

```
for each item: take it OR skip it → EITHER WAY, move to next item
```

- At every item: exactly **2 choices** (take / skip)
- After either choice: always advance → `idx + 1`
- **Branching = 2**, **Depth = n** (visit each item exactly once)

⇒ **TC = O(2^n)**

---

## 2️⃣ Unbounded Knapsack (reuse allowed)

```
at each "slot", pick ANY of the n items (or stop)
```

- Not "take/skip THIS item" — it's **"which item goes in this slot?"**
- Since reuse is allowed: **all n items are valid choices, every slot**
- **Branching = n**, **Depth = W / min(weight)** (how many slots fit before capacity runs out)

⇒ **TC = O(n^(W/min))**

---

## 🧪 Tiny trace (why branching = n, not 2)

`items = [A, B]` (n=2), unbounded, 3 slots:

```
Slot 1: choose A or B → 2 options
Slot 2: choose A or B again (reuse!) → 2 options
Slot 3: choose A or B again → 2 options

Total paths = 2 × 2 × 2 = n^depth
```

More items → more options *per slot* → branching = n, not fixed at 2.

---

## 🔗 Same shape as `combinationSum`

```typescript
for (let i = start; i < nums.length; i++) {
    path.push(nums[i]);
    backtrack(i, sum + nums[i], path);  // stays at i → reuse → unbounded knapsack shape
    path.pop();
}
```

**Unbounded knapsack ≡ combinationSum**: "items" = "numbers", "capacity" = "target". Same recursive skeleton, same `n^depth` complexity.

---

## 📊 Side-by-side

| | 0/1 Knapsack | Unbounded Knapsack |
|---|---|---|
| Traversal style | visit each item once | fill slots, reuse allowed |
| Index movement | always `idx+1` | take → stay (`idx`); skip → `idx+1` |
| Branching factor | 2 | n |
| Depth | n (all items visited) | W/min(weight) |
| TC (no memo) | O(2^n) | O(n^(W/min)) |

**Core idea:** branching factor isn't about "how many options exist" in the abstract — it's about **whether reuse forces you to re-offer all n choices at every step**, vs a fixed take/skip binary per item.

---

## 🧠 General TC formula (applies beyond knapsack, to any recursion/backtracking)

> **Total time = (cost of visiting/looping at every node) + (cost of any extra work done at each node)**

The branching/depth math above computes the first half (node count); remember to multiply by per-node work (e.g. array copies, sum checks) for the real total.
