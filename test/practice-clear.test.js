'use strict'
// Tests for the 🗑 Clear button on the dashboard Quick Practice and the per-topic Practice Session.
// Clear must (1) empty the generated set and return the UI to its "generate a new one" state,
// (2) survive a reload as empty, (3) never touch grades/statuses, and (4) leave Generate working.
// Run with: node --test test/practice-clear.test.js

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn } = require('./load-app')

let ctx
beforeEach(() => { ctx = loadApp() })
const ev = code => evalIn(ctx.sandbox, code)
const gradeQ = (k, g) => ev(`gradeRevise(${JSON.stringify(k)}, ${JSON.stringify(g)})`)
const qpSetup = () => ev(`_qpTopics = new Set(['trees']); _qpCount = 5; _qpMock = false; _qpRevised = false; _qpGenerate()`)
const panel = topic => ev(`_buildPracticePanel(${JSON.stringify(topic)}, TOPIC_MODULES[${JSON.stringify(topic)}])`)
// Graded / By Pattern only draw from questions you have graded — seed some (✗ forgot always appears; backdated so By Pattern sees them as due).
const seedGraded = (topic, n) => {
  const keys = ev(`Object.keys(TOPIC_MODULES[${JSON.stringify(topic)}].questions).slice(0, ${n})`)
  keys.forEach(k => gradeQ(k, 'forgot'))
  ev(`(function () { const all = JSON.parse(localStorage.getItem('dsa-revise-v1')); Object.keys(all).forEach(k => { all[k].last = new Date(Date.now() - 3*24*60*60*1000).toISOString() }); localStorage.setItem('dsa-revise-v1', JSON.stringify(all)) })()`)
  return keys
}
const enterTopic = topic => ev(`currentTopicKey = ${JSON.stringify(topic)}; _psCurrentItems = []; _psCurrentTopic = null; _psClearedTopics = new Set()`)

// ── Dashboard Quick Practice ────────────────────────────────────────────────

test('dashboard: Clear empties the set, keeps topic + count, and persists as empty', () => {
  qpSetup()
  assert.equal(ev('_qpResults.length'), 5)
  ev('_qpClear()')
  assert.equal(ev('_qpResults'), null)
  assert.deepEqual(ev('Array.from(_qpTopics)'), ['trees'], 'topic chips stay so one click regenerates')
  assert.equal(ev('_qpCount'), 5)
  ev('_qpResults = null; _loadQpState()')                       // simulate a page reload
  assert.equal(ev('_qpResults'), null, 'a reload must not bring the cleared set back')
})

test('dashboard: Generate works again after Clear', () => {
  qpSetup(); ev('_qpClear()'); ev('_qpGenerate()')
  assert.equal(ev('_qpResults.length'), 5)
})

test('dashboard: Clear with nothing generated is a harmless no-op', () => {
  assert.doesNotThrow(() => ev('_qpClear()'))
  assert.equal(ev('_qpResults'), null)
})

test('dashboard: Clear drops the this-session graded tint but NOT the grade itself', () => {
  qpSetup()
  const k = ev('_qpResults[0][0]')
  gradeQ(k, 'shaky'); ev(`_qpDoneThisSession.add(${JSON.stringify(k)}); _saveQpState()`)
  ev('_qpClear()')
  assert.equal(ev('_qpDoneThisSession.size'), 0)
  assert.equal(ev(`getRevise(${JSON.stringify(k)}).grade`), 'shaky', 'progress must survive Clear')
  ev('_qpGenerate()')
  const shown = ev('_qpResults.map(([x]) => x)')
  if (shown.includes(k)) assert.doesNotMatch(ev(`_qpRowsHtml()`), /ps-q-shaky/, 'old tint must not reappear on the next set')
})

test('dashboard: declining the confirm keeps the set (only asked when rows were graded)', () => {
  qpSetup()
  const k = ev('_qpResults[0][0]')
  ev(`_qpDoneThisSession.add(${JSON.stringify(k)})`)
  ctx.sandbox.confirm = () => false
  ev('_qpClear()')
  assert.equal(ev('_qpResults.length'), 5)
  ctx.sandbox.confirm = () => true
  ev('_qpClear()')
  assert.equal(ev('_qpResults'), null)
})

test('dashboard: Clear ends a running timer so it cannot keep counting on an empty list', () => {
  qpSetup()
  ev('_qpTimerTotal = 300; _qpTimerRem = 120; _qpTimerRun = true')
  ev('_qpClear()')
  assert.equal(ev('_qpTimerRun'), false)
  assert.equal(ev('_qpTimerRem'), 300, 'back to the preset, not a half-run clock')
  ev('_qpGenerate()')                                            // Generate is locked while a timer runs — must be free now
  assert.equal(ev('_qpResults.length'), 5)
})

test('dashboard: button is disabled with no list and enabled with one', () => {
  ev('_qpTopics = new Set(["trees"]); _qpResults = null')
  ctx.sandbox.document.getElementById = () => null
  // The panel HTML is built into an element; capture it through a stub.
  let html = ''
  ctx.sandbox.document.getElementById = id => id === 'quick-practice-panel'
    ? { set innerHTML(v) { html = v }, get innerHTML() { return html } }
    : id === 'qp-results' ? { innerHTML: '' } : null
  ev('_renderQuickPractice()')
  assert.match(html, /id="qp-btn-clear" disabled/)
  qpSetup()
  ev('_renderQuickPractice()')
  assert.doesNotMatch(html, /id="qp-btn-clear" disabled/)
  assert.match(html, /id="qp-btn-clear"/)
})

test('dashboard: with no topic picked, the empty state tells you what to do', () => {
  let html = ''
  const results = { set innerHTML(v) { html = v }, get innerHTML() { return html } }
  ctx.sandbox.document.getElementById = id => id === 'quick-practice-panel' ? { set innerHTML(v) {} } : id === 'qp-results' ? results : null
  ev('_qpTopics = new Set(); _qpRevised = false; _qpResults = null; _renderQuickPractice()')
  assert.match(html, /Pick at least one topic/)
})

// ── Per-topic Practice Session ──────────────────────────────────────────────

test('topic (Graded): Clear empties the list, deletes the saved session, offers Generate', () => {
  enterTopic('trees'); seedGraded('trees', 5)
  ev(`_psMode = 'graded'; _psQCount = 5`)
  panel('trees')
  ev(`_psGenerateGraded('trees')`)
  assert.equal(ev('_psCurrentItems.length'), 5)
  assert.ok(ev(`_psAllSessions()['trees']`), 'set is saved while it exists')
  ev(`_psClear('trees')`)
  assert.equal(ev('_psCurrentItems.length'), 0)
  assert.equal(ev(`_psAllSessions()['trees']`), undefined, 'reload must land empty, not restore the old set')
  const html = panel('trees')
  assert.match(html, /Generate/)
  assert.match(html, /Set cleared/)
  assert.doesNotMatch(html, /ps-btn-clear/, 'nothing to clear now')
})

test('topic: Generate after Clear builds a fresh set and shows Clear again', () => {
  enterTopic('trees'); seedGraded('trees', 4)
  ev(`_psMode = 'graded'; _psQCount = 4`)
  panel('trees'); ev(`_psGenerateGraded('trees')`); ev(`_psClear('trees')`)
  ev(`_psGenerateGraded('trees')`)
  assert.equal(ev('_psCurrentItems.length'), 4)
  assert.equal(ev(`_psClearedTopics.has('trees')`), false)
  assert.match(panel('trees'), /ps-btn-clear/)
})

test('topic (By Pattern): a cleared set does NOT silently auto-refill on re-render or revisit', () => {
  enterTopic('trees')
  // Give By Pattern something due so an auto-refill WOULD happen without the cleared flag.
  seedGraded('trees', 0)
  const keys = ev(`TOPIC_MODULES.trees.patterns[0].questionIds.slice(0, 3)`)
  keys.forEach(k => gradeQ(k, 'forgot'))
  ev(`(function () { const all = JSON.parse(localStorage.getItem('dsa-revise-v1')); Object.keys(all).forEach(k => { all[k].last = new Date(Date.now() - 3*24*60*60*1000).toISOString() }); localStorage.setItem('dsa-revise-v1', JSON.stringify(all)) })()`)
  ev(`_psMode = 'revise-pattern'; _psRevisePatterns = new Set(['P1']); _psQCount = 3`)
  panel('trees')
  ev(`_psShuffle('trees')`)
  assert.ok(ev('_psCurrentItems.length') > 0, 'precondition: By Pattern has a set')
  ev(`_psClear('trees')`)
  assert.equal(ev('_psCurrentItems.length'), 0)
  let html = panel('trees')                                      // re-render
  assert.equal(ev('_psCurrentItems.length'), 0, 're-render must not refill')
  assert.match(html, /Generate/, 'By Pattern gets a Generate button in its cleared state')
  ev(`_psCurrentItems = []; _psCurrentTopic = null`)             // leave the topic and come back
  panel('trees')
  assert.equal(ev('_psCurrentItems.length'), 0, 'revisit must not refill either')
  assert.equal(ev(`_psMode`), 'revise-pattern', 'mode is kept, only the set is dropped')
  ev(`_psGenerateGraded('trees')`)
  assert.ok(ev('_psCurrentItems.length') > 0, 'Generate rebuilds the By Pattern set')
})

test('topic: a mode switch or Refresh after Clear is a real regenerate (flag dropped)', () => {
  enterTopic('trees'); seedGraded('trees', 3)
  ev(`_psMode = 'graded'; _psQCount = 3`)
  panel('trees'); ev(`_psGenerateGraded('trees')`); ev(`_psClear('trees')`)
  assert.equal(ev(`_psClearedTopics.has('trees')`), true)
  ev(`_psSetMode('revise-pattern', 'trees')`)
  assert.equal(ev(`_psClearedTopics.has('trees')`), false)
})

test('topic: Recent is a read-only log — it has no Clear button', () => {
  enterTopic('trees')
  const k = ev(`Object.keys(TOPIC_MODULES.trees.questions)[0]`)
  gradeQ(k, 'shaky'); ev(`logRecent(${JSON.stringify(k)}, 'shaky')`)
  ev(`_psMode = 'recent'; _psQCount = 5`)
  const html = panel('trees')
  assert.doesNotMatch(html, /ps-btn-clear/)
})

test('topic: Clear on an already-empty panel is a no-op and grades are untouched', () => {
  enterTopic('trees')
  ev(`_psMode = 'graded'`)
  panel('trees')
  assert.doesNotThrow(() => ev(`_psClear('trees')`))
  assert.equal(ev(`_psClearedTopics.has('trees')`), false, 'nothing was cleared, so no flag')
  const k = ev(`Object.keys(TOPIC_MODULES.trees.questions)[0]`)
  gradeQ(k, 'shaky'); ev(`_psGenerateGraded('trees')`); ev(`_psClear('trees')`)
  assert.equal(ev(`getRevise(${JSON.stringify(k)}).grade`), 'shaky')
})

test('topic: Clear is per topic — other topics keep their saved sets', () => {
  enterTopic('trees'); seedGraded('trees', 3); seedGraded('graph', 3); ev(`_psMode = 'graded'; _psQCount = 3`)
  panel('trees'); ev(`_psGenerateGraded('trees')`)
  assert.ok(ev(`_psAllSessions()['trees']`), 'precondition: trees has a saved set')
  ev(`currentTopicKey = 'graph'; _psCurrentItems = []; _psCurrentTopic = null; _psClearedTopics = new Set()`)
  panel('graph'); ev(`_psGenerateGraded('graph')`)
  ev(`_psClear('graph')`)
  assert.equal(ev(`_psAllSessions()['graph']`), undefined)
  assert.ok(ev(`_psAllSessions()['trees']`), 'trees session must survive clearing graph')
})
