# 🧭 DP Fill Direction: Check EACH Variable Separately

**Use when:** converting a recursive DP into a bottom-up tabulation and deciding which loop(s) need to run forward vs backward.

## 🔑 The one test

> **For each variable: does `dp[X]` read `dp[SAME variable, different value]`? 🔁**
> - YES → needs ordered fill
> - NO → any order works

---

## ✅ Example: BOTH need ordering

📌 `uniquePaths`: `dp[i][j] = dp[i+1][j] + dp[i][j+1]`

- `i` reads `i+1` → fill `i` backward ⬆️
- `j` reads `j+1` → fill `j` backward ⬆️

**Both self-reference → both ordered.**

---

## ✅ Example: ONLY ONE needs ordering

📌 `minFallingPathSum`: `dp[row][prevCol] = min(grid[row][col] + dp[row+1][col])`

- `row` reads `row+1` → fill `row` backward ⬆️
- `prevCol` reads... `prevCol`? **Never.** It only reads `dp[row+1][col]` — a different variable. 🚫🔁

**Only `row` self-references → only `row` ordered. `prevCol` loops freely.**

---

## ⚙️ The general mechanism (why "backward" specifically, not just "ordered")

A self-referencing variable's fill direction isn't arbitrary — it's forced by one rule:

> **Whatever `dp[x]` depends on must already be COMPUTED before you compute `dp[x]`.**

- Reads `x+1` (a HIGHER index of itself) → `x+1` must be done first → fill `x` **high → low** (backward)
- Reads `x-1` (a LOWER index of itself) → `x-1` must be done first → fill `x` **low → high** (forward)

This is the same "dependency must exist before use" logic as topological sort — just for a 1D/2D array instead of a graph.

---

## 🧠 Anchor

**"2 variables ≠ 2 ordering rules. Check EACH one: does it read a DIFFERENT VALUE of ITSELF? Only THAT one needs direction."**
