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

// ── Row colours mean "graded in THIS generated set" ─────────────────────────
// A question graded on an earlier day must NOT show its old colour when it reappears
// in a freshly generated set; a grade thrown in this set must show, and must survive
// a reload (doneThisSession is persisted in dsa-qp-state-v1).

const rowHtml = (lcKey, topicKey, fn, ctxArg) =>
  evalIn(ctx.sandbox, `${fn}([${JSON.stringify(lcKey)}, TOPIC_MODULES[${JSON.stringify(topicKey)}].questions[${JSON.stringify(lcKey)}]], 0, ${ctxArg})`)

test('plain list: a question graded on a previous day starts NEUTRAL in a new generated set', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'shaky')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set()`) // new generate clears it
  assert.doesNotMatch(rowHtml(lcKey, topicKey, '_buildPracticeItem', 'true'), /ps-q-shaky|rev-chosen/)
})

test('plain list: a grade thrown in this set colours the row and survives a reload', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  evalIn(ctx.sandbox, `_qpTopics = new Set(['sliding-window']); _qpCount = 5; _qpMock = false; _qpRevised = false; _qpGenerate()`)
  const k = evalIn(ctx.sandbox, `_qpResults[0][0]`)
  const t = evalIn(ctx.sandbox, `Object.keys(TOPIC_MODULES).find(t => TOPIC_MODULES[t].questions[${JSON.stringify(k)}])`)
  evalIn(ctx.sandbox, `_practiceGrade(null, ${JSON.stringify(k)}, 'shaky', true)`)
  assert.match(rowHtml(k, t, '_buildPracticeItem', 'true'), /ps-q-shaky/)
  evalIn(ctx.sandbox, `_qpResults = null; _qpDoneThisSession = new Set(); _loadQpState()`) // reopen tab
  assert.match(rowHtml(k, t, '_buildPracticeItem', 'true'), /ps-q-shaky/, 'colour must survive reload')
})

test('Graded panel: previously-graded rows start neutral until graded in this set', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'shaky')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set(); _qpRevised = true`)
  assert.doesNotMatch(rowHtml(lcKey, topicKey, '_buildReviseItem', "'qp'"), /rg-shaky|ps-q-shaky/)
})

test('Graded panel: grading in this set shows the badge', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  evalIn(ctx.sandbox, `_qpRevised = true`)
  grade(lcKey, 'shaky')
  evalIn(ctx.sandbox, `_qpDoneThisSession.add(${JSON.stringify(lcKey)})`)
  assert.match(rowHtml(lcKey, topicKey, '_buildReviseItem', "'qp'"), /rg-shaky/)
})

test('un-revealed Mock hides a graded-this-set colour; Reveal shows it', () => {
  const { lcKey, topicKey } = anyQuestion(ctx.sandbox, 'sliding-window')
  grade(lcKey, 'solid')
  evalIn(ctx.sandbox, `_qpDoneThisSession = new Set([${JSON.stringify(lcKey)}]); _qpMock = true; _qpMockReveal = false`)
  assert.doesNotMatch(rowHtml(lcKey, topicKey, '_buildPracticeItem', 'true'), /rev-chosen/)
  evalIn(ctx.sandbox, `_qpMockReveal = true`)
  assert.match(rowHtml(lcKey, topicKey, '_buildPracticeItem', 'true'), /ps-q-solid/)
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
