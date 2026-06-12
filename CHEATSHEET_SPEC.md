# Cheat Sheet Spec

The shared definition of what an algorithm/topic cheat sheet in this repo is, and the
quality bar it must meet. Read this **before** creating or editing any `*.html` cheat
sheet (graph, backtracking, dp, and future topics).

---

## 1. The motto (what a cheat sheet is FOR)

> A single, dense, printable, trustworthy reference that lets me **rapidly recall and
> revise an entire algorithmic topic right before a FAANG SDE2/SDE3 interview — in
> TypeScript.**

Three load-bearing ideas:

- **Recall, not learn.** It's a revision tool for someone who already knows the material.
  It jogs memory fast; it is **not** a tutorial. Favor pattern-maps, templates, and
  "keyword → pattern" tables over prose explanation.
- **Dense.** Maximum signal per square inch. Every section earns its space.
- **Trustworthy.** One subtly-wrong snippet poisons the whole sheet, because the content
  is memorized as gold, not reasoned through on the spot. Correctness is non-negotiable.

---

## 2. Structural DNA (the section skeleton every sheet shares)

1. Emoji "logo" + title + subtitle — `<topic> CheatSheet`, subtitle
   *SDE2/SDE3 FAANG Interview Edition | TypeScript*.
2. **Quick Navigation** grid (`.nav-index` component) linking every section.
3. **Decision Framework** — "when do I even reach for this pattern?"
4. **Universal Template** — the one skeleton everything else is a variation of.
5. **Keyword → Pattern map** — interview phrase → which template to use.
6. Numbered **template sections** — each with concrete LeetCode problems + TypeScript.
7. **Complexity** table.
8. **Top-N LC problems** map.
9. **Interview script** + **Pre-interview rapid revision** closer.

A new sheet should be visually indistinguishable in chrome (CSS, nav grid, headings,
code blocks, emoji header) from the existing three.

---

## 3. Quality bars

### 3.1 Purpose fit
Every section must serve *recall under time pressure*. If a section reads like a
textbook, it's wrong for this format — cut or compress it.

### 3.2 Correctness (highest bar)
- TypeScript compiles and is logically correct: edge cases, return values, base cases,
  pruning conditions.
- Complexity claims (time & space) are right.
- LC numbers map to the right problem name.
- Emoji/logo and labels are accurate, including honesty notes
  (e.g. "⚠️ NOT actually backtracking").

### 3.3 Style consistency
All sheets share one stylesheet and structure: same CSS, same `.nav-index` component,
same heading hierarchy, same code-block treatment (blue left-border `#0066cc`), same
emoji-header pattern, same section-ordering convention.

### 3.4 A4 print efficiency  — *the explicit pain point*
Goal: **fit the whole topic in as few A4 pages as possible with no wasted border space.**

- **Density target: BALANCED.** Dense but comfortably readable at arm's length — base
  print font ~**11px** (not the 9–10px max-cram, not loose textbook spacing). Tune line
  spacing and code font to keep it legible while minimizing page count.
- **Margins: ONE source, `0.3in`.** Known bug to avoid: setting both `@page { margin }`
  AND a print-mode `body { margin }` *stacks* them (e.g. `0.35in` + `0.3in` ≈ `0.65in`)
  and eats ~16% of A4 width as border. Rule: `@page { margin: 0.3in }` and body margin
  **`0`** in print — never both.
- `page-break-inside: avoid` on code blocks, tables, and sections so nothing splits
  awkwardly across pages.
- Headings use `page-break-after: avoid` so a header never strands at a page bottom.
- Consider multi-column flow (`.column-list`) to fill page width where content suits it.

### Canonical print CSS (copy-paste for any new sheet)

```css
@page { margin: 0.3in; }            /* the ONLY margin source */

@media only print {
  html, body {
    font-size: 11px !important;     /* balanced: dense but legible at arm's length */
    line-height: 1.2 !important;
    color: #111 !important;
    margin: 0 !important;           /* NOT 0.3in — @page already handles it */
    padding: 0 !important;
  }
  h1, .page-title { font-size: 15px !important; page-break-after: avoid !important;
                    page-break-inside: avoid !important; }
  h2 { font-size: 13px !important; page-break-after: avoid !important; }
  h3 { font-size: 12px !important; page-break-after: avoid !important; }
  p, li, div { page-break-inside: avoid !important; }
  .code, pre, table, tr, td, th, figure, section, article {
    page-break-inside: avoid !important;
  }
  .code, pre { font-size: 9.5px !important; line-height: 1.2 !important; }
}
```

### Browser print recipe

Chrome → **Cmd+P** → Paper **A4** · Margins **Default** (now governed by `@page`) ·
**Background graphics ON** (so callout/code backgrounds render).

---

## 4. Working process when creating / revising a sheet

1. **Restate the motto for the specific topic** — what is the reader trying to recall?
2. **Draft the section skeleton** (Section 2) adapted to the topic.
3. **Write content** to the purpose-fit + correctness bars (Section 3.1–3.2).
4. **Match styling** to existing sheets (3.3).
5. **Verify print** at A4, balanced density, minimal pages, no wasted borders (3.4).

---

## 5. Existing sheets — audit status

Each existing sheet gets audited one-by-one against this spec (separate pass).

All three currently share **identical** print CSS with the double-margin bug
(`@page 0.35in` + print `body 0.3in`). Part 2 of the audit applies the canonical print
CSS above to all three first; content audit follows per sheet.

| Sheet              | Print margin fixed? | Content audited? | Notes |
|--------------------|---------------------|------------------|-------|
| `graph.html`       | ✅ done             | ✅ done          | fixed 2 broken emojis, LC743 (1→-1), LC864→847, typo; trimmed redundant TOC |
| `dp.html`          | ✅ done             | ✅ done          | fixed "palindrome palindrome" typo; all 81 code blocks verified; kept single-column (code/ASCII tables need full width) |
| `backtracking.html`| ✅ done             | ✅ done          | fixed misleading LC62→LC79 in keyword map; all 48 code blocks verified; single-column |
