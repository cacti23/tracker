'use strict'
// Regression tests for the logic bugs found in the 2026-09-26 audit.
// Run with: node --test test/audit-fixes.test.js
//
// Pinned to IST (UTC+5:30): the streak bug only shows up when the local day and the UTC day differ,
// which is exactly the case for someone practicing late at night in India.
process.env.TZ = 'Asia/Kolkata'

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn } = require('./load-app')

let ctx
beforeEach(() => { ctx = loadApp() })
const ev = code => evalIn(ctx.sandbox, code)

// Freeze "now" inside the app's vm context to a LOCAL wall-clock time.
function at(y, mo, d, h, mi) {
  const Real = Date
  const t = new Real(y, mo - 1, d, h, mi).getTime()
  class FD extends Real { constructor(...a) { if (a.length) super(...a); else super(t) } static now() { return t } }
  ctx.sandbox.Date = FD
}

// ── Streak uses the LOCAL calendar day ─────────────────────────────────────────────────────────

test('streak: 11pm one night and 1am the next local day are two consecutive days', () => {
  at(2026, 9, 21, 23, 0); ev('_updateStreak()')
  at(2026, 9, 22, 1, 0);  ev('_updateStreak()')     // same UTC date (Sep 21), different local date
  assert.equal(ev('getStreak()').streak, 2)
})

test('streak: two sessions on the same local day count once', () => {
  at(2026, 9, 21, 8, 0);  ev('_updateStreak()')
  at(2026, 9, 21, 23, 30); ev('_updateStreak()')
  assert.equal(ev('getStreak()').streak, 1)
})

test('streak: skipping a whole local day resets it to 1', () => {
  at(2026, 9, 21, 9, 0); ev('_updateStreak()')
  at(2026, 9, 23, 9, 0); ev('_updateStreak()')
  assert.equal(ev('getStreak()').streak, 1)
})

test('streak: still alive (not yet done today) the morning after', () => {
  at(2026, 9, 21, 22, 0); ev('_updateStreak()')
  at(2026, 9, 22, 7, 0)
  const s = ev('getStreak()')
  assert.equal(s.streak, 1); assert.equal(s.today, false)
})

test('solid-grade solve credit is once per LOCAL day (not per UTC day)', () => {
  const k = 'LC_104'
  at(2026, 9, 21, 23, 0); ev(`gradeRevise('${k}', 'solid')`)
  assert.equal(ev(`getSolveCount('${k}')`), 1)
  at(2026, 9, 22, 1, 0);  ev(`gradeRevise('${k}', 'solid')`)     // next local day → credited again
  assert.equal(ev(`getSolveCount('${k}')`), 2)
  at(2026, 9, 22, 20, 0); ev(`gradeRevise('${k}', 'solid')`)     // same local day → not again
  assert.equal(ev(`getSolveCount('${k}')`), 2)
})

test('_localDay is the local calendar date', () => {
  at(2026, 9, 22, 0, 30)
  assert.equal(ev('_localDay()'), '2026-09-22')
})

// ── Cross-listed questions are counted once ────────────────────────────────────────────────────

test('_uniqueQuestionKeys de-dupes cross-listed questions', () => {
  const sum = ev(`TOPICS.reduce((n, t) => n + (TOPIC_MODULES[t.key] ? Object.keys(TOPIC_MODULES[t.key].questions).length : 0), 0)`)
  const uniq = ev('_uniqueQuestionKeys().size')
  assert.ok(uniq < sum, 'the tracker has cross-listed questions, so unique < sum of topic sizes')
  assert.equal(ev(`_uniqueQuestionKeys(['sorting','intervals']).size`), ev(`(function(){ const s = new Set(); ['sorting','intervals'].forEach(t => Object.keys(TOPIC_MODULES[t].questions).forEach(k => s.add(k))); return s.size })()`))
  assert.ok(ev(`_uniqueQuestionKeys(['sorting','intervals']).size`) < ev(`Object.keys(TOPIC_MODULES.sorting.questions).length + Object.keys(TOPIC_MODULES.intervals.questions).length`))
})

test('dashboard due counters count a cross-listed question once (LC_56 is in Sorting AND Intervals)', () => {
  ev(`setStatus('LC_56', 'Solved')`)                       // engaged + never practiced ⇒ due for both queues
  const els = { 'due-code-count': { textContent: '' }, 'due-revise-count': { textContent: '' } }
  ctx.sandbox.document.getElementById = id => els[id] || null
  ev('_refreshDueCounts()')
  assert.equal(els['due-code-count'].textContent, 1)
  assert.equal(els['due-revise-count'].textContent, 1)
})

// ── Cooldown rules for Graded and pinned questions ─────────────────────────────────────────────

test('dashboard Graded shows a ~ shaky question even while it is resting (same as per-topic Graded)', () => {
  const k = 'LC_104'
  ev(`markPracticed('${k}'); bumpReviewInterval('${k}'); gradeRevise('${k}', 'shaky')`)
  ev(`_psMode = 'graded'`)
  assert.ok(ev(`_psModePool('trees', 50).map(([x]) => x).includes('${k}')`), 'per-topic Graded shows it')
  ev(`_qpRevised = true; _qpMock = false; _qpTopics = new Set(); _qpCount = 50; _qpGenerate()`)
  assert.ok(ev(`_qpResults.map(([x]) => x).includes('${k}')`), 'dashboard Graded must show it too')
})

test('a resting ✓ solid question still waits for its revise ladder in dashboard Graded', () => {
  const k = 'LC_104'
  ev(`markPracticed('${k}'); bumpReviewInterval('${k}'); gradeRevise('${k}', 'solid')`)
  ev(`_qpRevised = true; _qpMock = false; _qpTopics = new Set(); _qpCount = 50; _qpGenerate()`)
  assert.ok(!ev(`_qpResults.map(([x]) => x).includes('${k}')`))
})

test('a pinned question is never "resting" — it always stays in the practice pool', () => {
  const k = 'LC_104'
  ev(`setStatus('${k}', 'Solved'); markPracticed('${k}'); bumpReviewInterval('${k}')`)
  assert.equal(ev(`_onCooldown('${k}')`), true, 'precondition: unpinned + just solved ⇒ resting')
  ev(`togglePin('${k}')`)
  assert.equal(ev(`_onCooldown('${k}')`), false)
  ev(`_qpTopics = new Set(['trees']); _qpRevised = false; _qpMock = false; _qpCount = 50; _qpGenerate()`)
  assert.ok(ev(`_qpResults.map(([x]) => x).includes('${k}')`), 'dashboard set includes the pinned question')
})

test('an unpinned resting question is still hidden from a normal generated set', () => {
  const k = 'LC_104'
  ev(`setStatus('${k}', 'Solved'); markPracticed('${k}'); bumpReviewInterval('${k}')`)
  ev(`_qpTopics = new Set(['trees']); _qpRevised = false; _qpMock = false; _qpCount = 50; _qpGenerate()`)
  assert.ok(!ev(`_qpResults.map(([x]) => x).includes('${k}')`))
})

test('the "max N from selected" limit counts overlapping topics once', () => {
  ev(`_qpTopics = new Set(['sorting','intervals']); _qpRevised = false; _qpMock = false; _qpCount = 500; _qpGenerate()`)
  assert.equal(ev('_qpResults.length'), ev(`_uniqueQuestionKeys(['sorting','intervals']).size`))
  ev('_qpCount = 1')
  for (let i = 0; i < 500; i++) ev('_qpAdjCount(1)')
  assert.equal(ev('_qpCount'), ev(`_uniqueQuestionKeys(['sorting','intervals']).size`), '+ must stop at the true unique maximum')
})

// ── Data invariants that the UI relies on ──────────────────────────────────────────────────────

test('every question has a frequency tier (else it vanishes from the High/Medium/Low filter counts)', () => {
  const missing = ev(`(function () { const bad = []; Object.entries(TOPIC_MODULES).forEach(([t, m]) => Object.entries(m.questions).forEach(([k, q]) => { if (!['High','Medium','Low'].includes(q.freq)) bad.push(t + ':' + k) })); return bad })()`)
  assert.equal(JSON.stringify(missing), '[]')
})

test('every pattern reference resolves, and every question belongs to exactly one pattern', () => {
  const problems = ev(`(function () {
    const out = []
    Object.entries(TOPIC_MODULES).forEach(([t, m]) => {
      if (!m.patterns) return
      const seen = {}
      m.patterns.forEach(p => p.questionIds.forEach(id => { seen[id] = (seen[id] || 0) + 1; if (!m.questions[id]) out.push(t + ' dangling ' + id) }))
      Object.keys(m.questions).forEach(id => { if (!seen[id]) out.push(t + ' orphan ' + id); if (seen[id] > 1) out.push(t + ' in ' + seen[id] + ' patterns ' + id) })
    })
    return out
  })()`)
  assert.equal(JSON.stringify(problems), '[]')
})

test('every question has a valid difficulty and a link', () => {
  const bad = ev(`(function () { const out = []; Object.entries(TOPIC_MODULES).forEach(([t, m]) => Object.entries(m.questions).forEach(([k, q]) => { if (!['Easy','Medium','Hard'].includes(q.difficulty)) out.push(t + ':' + k + ' difficulty'); if (!/^https?:\\/\\//.test(q.link || '')) out.push(t + ':' + k + ' link') })); return out })()`)
  assert.equal(JSON.stringify(bad), '[]')
})
