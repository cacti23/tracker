'use strict'
// Tests for the REVISE queue (grade storage + ladder) and for the two dashboard/
// per-topic rendering bugs fixed on 2026-09-23:
//   1. Graded panel (dashboard "🕒 Graded" + per-topic "Graded" tab) hid a
//      question's real grade badge unless it had been graded in the current
//      in-memory session — so reopening the tab made old grades look blank.
//   2. The plain generated practice list had the same flaw for its tint/due-dot.
// Run with: node --test test/grading.test.js

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn, anyQuestion, nQuestions } = require('./load-app')

let ctx
beforeEach(() => { ctx = loadApp() })

function grade(lcKey, g) { return evalIn(ctx.sandbox, `gradeRevise(${JSON.stringify(lcKey)}, ${JSON.stringify(g)})`) }
function getRevise(lcKey) { return evalIn(ctx.sandbox, `getRevise(${JSON.stringify(lcKey)})`) }
function isReviseDue(lcKey) { return evalIn(ctx.sandbox, `isReviseDue(${JSON.stringify(lcKey)})`) }

// ── REVISE_KEY storage: the actual source of truth ─────────────────────────

test('grading a question stores exactly the grade you clicked', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'shaky')
  assert.equal(getRevise(lcKey).grade, 'shaky')
})

test('re-grading overwrites the previous grade, it does not merge/stick', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'solid')
  assert.equal(getRevise(lcKey).grade, 'solid')
  grade(lcKey, 'forgot')
  assert.equal(getRevise(lcKey).grade, 'forgot', 'grading forgot after solid must not leave grade stuck at solid')
  grade(lcKey, 'shaky')
  assert.equal(getRevise(lcKey).grade, 'shaky', 'grading shaky after forgot must not leave grade stuck at forgot/solid')
})

test('grading forgot force-queues the question back into the CODE queue', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'forgot')
  assert.equal(evalIn(ctx.sandbox, `isCodeForced(${JSON.stringify(lcKey)})`), true)
  grade(lcKey, 'solid')
  assert.equal(evalIn(ctx.sandbox, `isCodeForced(${JSON.stringify(lcKey)})`), false, 'a later clean solid grade should clear the forced flag')
})

// ── REVISE ladder (1,2,4,8,16 days) ─────────────────────────────────────────

test('a fresh solid grade is not due again immediately', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'solid')
  assert.equal(isReviseDue(lcKey), false)
})

test('solid grade becomes due again once its interval has elapsed', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'solid') // first solid -> interval = 1 day (REVISE_LADDER[0])
  const rec = getRevise(lcKey)
  assert.equal(rec.interval, 1)
  // Simulate 2 days passing by rewriting `last` directly in storage (same shape markRevised writes).
  evalIn(ctx.sandbox, `
    (function () {
      const all = JSON.parse(localStorage.getItem('dsa-revise-v1'))
      all[${JSON.stringify(lcKey)}].last = new Date(Date.now() - 2*24*60*60*1000).toISOString()
      localStorage.setItem('dsa-revise-v1', JSON.stringify(all))
    })()
  `)
  assert.equal(isReviseDue(lcKey), true)
})

test('shaky keeps a short ~2-day loop regardless of how many times it was graded before', () => {
  const { lcKey } = anyQuestion(ctx.sandbox)
  grade(lcKey, 'solid'); grade(lcKey, 'solid'); grade(lcKey, 'solid') // push interval up the ladder
  grade(lcKey, 'shaky')
  assert.equal(getRevise(lcKey).interval, 2, 'shaky should reset to the short loop, not inherit the solid ladder position')
})

// ── Dashboard "🕒 Graded" pool (_qpGenerate with _qpRevised = true) ─────────

test('Graded pool only includes questions that have actually been graded', () => {
  const [a, b] = nQuestions(ctx.sandbox, 'sliding-window', 2)
  grade(a, 'shaky')
  // b is left ungraded
  evalIn(ctx.sandbox, `_qpRevised = true; _qpMock = false; _qpRevise = false; _qpTopics = new Set(); _qpCount = 50`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  const keys = evalIn(ctx.sandbox, `_qpResults.map(([k]) => k)`)
  assert.ok(keys.includes(a), 'graded question should be in the pool')
  assert.ok(!keys.includes(b), 'ungraded question should not be in the pool')
})

test('Graded pool never drops a shaky/forgot question to the count cap, only pads with solid', () => {
  const qs = nQuestions(ctx.sandbox, 'sliding-window', 6)
  qs.slice(0, 4).forEach(k => grade(k, 'shaky'))
  qs.slice(4).forEach(k => grade(k, 'solid'))
  evalIn(ctx.sandbox, `_qpRevised = true; _qpMock = false; _qpRevise = false; _qpTopics = new Set(['sliding-window']); _qpCount = 1`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  const keys = evalIn(ctx.sandbox, `_qpResults.map(([k]) => k)`)
  qs.slice(0, 4).forEach(k => assert.ok(keys.includes(k), `shaky question ${k} must never be cut by the count cap`))
})

test('a freshly-solid-graded question drops out of the Graded pool until its ladder is due again', () => {
  const { lcKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'solid')
  evalIn(ctx.sandbox, `_qpRevised = true; _qpMock = false; _qpRevise = false; _qpTopics = new Set(); _qpCount = 50`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  const keys = evalIn(ctx.sandbox, `_qpResults.map(([k]) => k)`)
  assert.ok(!keys.includes(lcKey), 'this is intentional spaced-repetition behavior, not a bug — a just-graded solid question should rest until due')
})

// ── Regression: badges must reflect the REAL stored grade, not session-only state ──
// (This is the actual bug reported: grading 35 questions, closing the tab, reopening
// it — most of them rendered as "not graded" because the visual badge/tint only
// looked at an in-memory "graded this session" Set instead of the real data.)

test('REGRESSION: Graded-panel row shows the real grade after the session Set is cleared (tab reopened)', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  const q = evalIn(ctx.sandbox, `TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]`)
  grade(lcKey, 'shaky')
  // Simulate "closed the tab and reopened it": the in-memory done-this-session
  // Set is gone (a fresh page load starts it empty; _qpGenerate() also clears it).
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set(); _qpRevised = true`)
  const html = evalIn(ctx.sandbox, `_buildReviseItem([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, 'qp')`)
  assert.match(html, /rg-shaky/, 'the shaky grade badge must render even though doneThisSession is empty')
})

test('REGRESSION: plain generated-list row shows the real grade after the session Set is cleared', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'forgot')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set()`) // simulate reopening the tab
  const html = evalIn(ctx.sandbox, `_buildPracticeItem([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, true)`)
  assert.match(html, /ps-q-forgot/, 'the row tint must reflect the real forgot grade even though doneThisSession is empty')
})

test('REGRESSION: per-topic Graded tab (ctx="ps") also shows the real grade with an empty session Set', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'solid')
  evalIn(ctx.sandbox, `_psDoneThisSession = new Set(); _psMode = 'graded'`)
  const html = evalIn(ctx.sandbox, `_buildReviseItem([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, 'ps')`)
  assert.match(html, /rg-solid/, 'per-topic Graded rows must also show the persisted grade regardless of session state')
})

// ── Guard rail: Mock mode must still hide grades before "Reveal" ───────────
// The fix must not leak this behavior into Mock, where showing a past grade
// before you attempt the cold question would spoil the test.

test('GUARD: un-revealed Mock still hides a past grade (no spoiler regression)', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'solid')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set(); _qpMock = true; _qpMockReveal = false`)
  const html = evalIn(ctx.sandbox, `_buildPracticeItem([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, true)`)
  assert.doesNotMatch(html, /ps-q-solid/, 'an un-revealed Mock question must not be pre-tinted with its past grade')
})

test('GUARD: after Reveal, Mock shows the real grade again', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'solid')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set(); _qpMock = true; _qpMockReveal = true`)
  const html = evalIn(ctx.sandbox, `_buildPracticeItem([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, true)`)
  assert.match(html, /ps-q-solid/, 'once revealed, Mock rows should behave like normal rows again')
})

// ── QP state persistence round-trip (dsa-qp-state-v1) ───────────────────────

// ── Multi-tab clobber: a backgrounded tab must re-sync from disk on refocus ─
// (Root cause behind the original "dashboard shows only a few graded questions"
// report: each tab loads dsa-qp-state-v1 into memory once and never re-reads it.
// A stale background tab acting on its old in-memory copy would silently save it
// back over whatever a different, more-recently-used tab had just written.)

test('REGRESSION: _loadQpState() fully replaces in-memory state instead of merging with what a tab already had', () => {
  // "Tab A" generates a set from topic A and saves it. (_qpGenerate() weighted-shuffles
  // its pick from the whole topic, so we read back whichever key it actually chose
  // rather than assuming which one — the point of this test is the resync behavior,
  // not which specific question got picked.)
  evalIn(ctx.sandbox, `_qpTopics = new Set(['sliding-window']); _qpCount = 2; _qpMock = false; _qpRevised = false`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  const qA0 = evalIn(ctx.sandbox, `_qpResults[0][0]`)
  evalIn(ctx.sandbox, `_practiceGrade(null, ${JSON.stringify(qA0)}, 'shaky', true)`)

  // "Tab B" (this same in-memory context standing in for a second tab) generates a
  // DIFFERENT set from topic B and grades one — this is what ends up as the latest
  // truth on disk.
  evalIn(ctx.sandbox, `_qpTopics = new Set(['two-pointers']); _qpCount = 2`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  const qB0 = evalIn(ctx.sandbox, `_qpResults[0][0]`)
  evalIn(ctx.sandbox, `_practiceGrade(null, ${JSON.stringify(qB0)}, 'solid', true)`)

  // Now simulate switching back into stale "Tab A": its in-memory _qpTopics/_qpResults
  // still point at topic A's set from before Tab B ever ran. Re-syncing from disk
  // (what the visibilitychange handler does on refocus) must fully adopt Tab B's
  // state, not merge Tab A's stale topic selection into it.
  evalIn(ctx.sandbox, `_qpTopics = new Set(['sliding-window'])`) // stale in-memory leftover
  evalIn(ctx.sandbox, `_loadQpState()`)

  const topics = evalIn(ctx.sandbox, `Array.from(_qpTopics)`)
  assert.deepEqual(topics, ['two-pointers'], 'stale topic selection must be fully replaced, not merged, by the on-disk state')
  const resultKeys = evalIn(ctx.sandbox, `_qpResults.map(([k]) => k)`)
  assert.ok(resultKeys.includes(qB0), 'the disk-truth result set (from the other tab) must win after a resync')
})

test('save/load round-trip preserves generated results and per-session done-set', () => {
  const qs = nQuestions(ctx.sandbox, 'sliding-window', 3)
  evalIn(ctx.sandbox, `_qpTopics = new Set(['sliding-window']); _qpCount = 3; _qpMock = false; _qpRevised = false`)
  evalIn(ctx.sandbox, `_qpGenerate()`)
  grade(qs[0], 'shaky')
  evalIn(ctx.sandbox, `_practiceGrade(null, ${JSON.stringify(qs[0])}, 'shaky', true)`) // also marks doneThisSession + saves
  evalIn(ctx.sandbox, `_saveQpState()`)

  // Simulate a fresh page load: brand-new in-memory state, same localStorage.
  evalIn(ctx.sandbox, `_qpResults = null; _qpDoneThisSession = new Set()`)
  evalIn(ctx.sandbox, `_loadQpState()`)

  const resultKeys = evalIn(ctx.sandbox, `_qpResults ? _qpResults.map(([k]) => k) : null`)
  assert.ok(resultKeys && resultKeys.length === 3, 'the generated set must survive a reload')
  const done = evalIn(ctx.sandbox, `_qpDoneThisSession.has(${JSON.stringify(qs[0])})`)
  assert.equal(done, true, 'doneThisSession must survive a reload too')
})
