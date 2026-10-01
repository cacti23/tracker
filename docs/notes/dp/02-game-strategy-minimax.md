# 🎮 Game Strategy (Minimax)

**Use when:** the problem is a two-player turn-based game (e.g. "can Player 1 win / what's their optimal score assuming both play optimally") — signals a minimax-shaped DP.

## 🧠 Core Principle

### 🙋 Your Turn
> **Always make the best possible move.**

- Maximize your score.
- Choose the move that gives you the best outcome.
- Think: **"What is my best move?"**

### 🆚 Opponent's Turn
> **Assume your opponent plays perfectly.**

- Expect the **worst-case** move for you.
- They will always choose the move that minimizes your result.
- Think: **"If my opponent is optimal, what is the worst they can do to me?"**

---

## 🔑 Easy Mental Model

| Turn | Goal |
|------|------|
| 😊 Your Turn | **Maximize** your result |
| 😈 Opponent's Turn | **Minimize** your result |

## 🧩 Formula

```text
Your Turn      → max(all possible moves)
Opponent Turn  → min(all possible moves)
```

---

## 📝 One-Line Reminder

> 🎯 **On your turn, do your best. On your opponent's turn, expect the worst.**
