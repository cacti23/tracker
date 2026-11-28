'use strict'
// Regression tests for the DSA Notebook state bugs fixed in v507:
//   N1  a same-day re-grade is a correction (credits once; ✓ → ✗ takes the credit back)
//   N2  the must-code flag set by ✗ survives later recall grades; only a clean solve clears it
//   N3  an unsaved topic-note draft survives re-renders, topic switches and reloads;
//       per-question notes save while typing, not only on blur
//   N4  a question cycled back to 📋 but still engaged isn't counted in the Pending backlog
//   N5  practice-session keys are sync noise; a stale tab re-reads the per-topic session on refocus
//   N6  a status change refreshes the sidebar badge of every topic listing the question
//   N7  a saved session drops removed questions; a topic without one opens in the default mode
//   N8  an expired timer reads 00:00 on re-render, not the full preset
// Run with: node --test test/notebook-state.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadApp, loadAppWithDom, makeLocalStorage, evalIn } = require('./load-app')

const EV = '({ stopPropagation() {}, currentTarget: { closest: () => null } })'

// Freeze "now" inside one app context at a local wall-clock time.
function at(sandbox, y, mo, d, h) {
  const Real = Date
  const t = new Real(y, mo - 1, d, h, 0).getTime()
  class FD extends Real { constructor(...a) { if (a.length) super(...a); else super(t) } static now() { return t } }
  sandbox.Date = FD
}

// Per-topic Graded set holding one question, the way the Graded tab has it on screen.
function gradedSetup(topic) {
  const ctx = loadApp()
  const ev = code => evalIn(ctx.sandbox, code)
  const k = ev(`Object.keys(TOPIC_MODULES[${JSON.stringify(topic)}].questions)[0]`)
  ev(`currentTopicKey = ${JSON.stringify(topic)}; _psCurrentTopic = currentTopicKey; _psMode = 'graded'
      _psCurrentItems = [[${JSON.stringify(k)}, TOPIC_MODULES[currentTopicKey].questions[${JSON.stringify(k)}]]]`)
  const grade = g => ev(`_psRecallGrade(${EV}, ${JSON.stringify(k)}, ${JSON.stringify(g)})`)
  const state = () => ev(`({ interval: getReviewInterval(${JSON.stringify(k)}), solves: getSolveCount(${JSON.stringify(k)}),
    status: getStatus(${JSON.stringify(k)}), practiced: getLastPracticed(${JSON.stringify(k)}),
    forced: isCodeForced(${JSON.stringify(k)}), cooldown: _onCooldown(${JSON.stringify(k)}) })`)
  return { ctx, ev, k, grade, state }
}

// ── N1 ─────────────────────────────────────────────────────────────────────────────────────────

test('N1: repeated ✓ in Graded the same day credits once (code ladder + solve count)', () => {
  const { grade, state } = gradedSetup('two-pointers')
  grade('solid')
  const once = state()
  assert.equal(once.interval, 2); assert.equal(once.solves, 1)
  grade('solid'); grade('solid'); grade('solid')
  assert.equal(state().interval, 2, 'four ✓ clicks must not climb the ladder to 14 days')
  assert.equal(state().solves, 1)
})

test('N1: repeated ✓ on a plain practice list credits once too', () => {
  const { ev, k } = gradedSetup('two-pointers')
  ev(`_practiceGrade(null, ${JSON.stringify(k)}, 'solid', false)`)
  ev(`_practiceGrade(null, ${JSON.stringify(k)}, 'solid', false)`)
  ev(`_practiceGrade(null, ${JSON.stringify(k)}, 'solid', false)`)
  assert.equal(ev(`getReviewInterval(${JSON.stringify(k)})`), 2)
})

test('N1: correcting ✓ to ✗ the same day takes the ✓ credit back', () => {
  const { grade, state } = gradedSetup('two-pointers')
  grade('solid')
  grade('forgot')
  const s = state()
  assert.equal(s.interval, 1, 'code ladder back where it was before the ✓')
  assert.equal(s.solves, 0, 'solve credit taken back')
  assert.equal(s.practiced, null, 'last-practiced back to never')
  assert.notEqual(s.status, 'Solved', 'the ✓ marked it Solved; the correction undoes that')
  assert.equal(s.cooldown, false)
  assert.equal(s.forced, true, 'the ✗ itself still applies')
})

test('N1: ✓ ✗ ✓ the same day credits the solve count once', () => {
  const { grade, state } = gradedSetup('two-pointers')
  grade('solid'); grade('forgot'); grade('solid')
  assert.equal(state().solves, 1)
  assert.equal(state().interval, 2)
})

test('N1: the revise ladder also steps once per day', () => {
  const { ev, k } = gradedSetup('two-pointers')
  ev(`gradeRevise(${JSON.stringify(k)}, 'solid'); gradeRevise(${JSON.stringify(k)}, 'solid'); gradeRevise(${JSON.stringify(k)}, 'solid')`)
  assert.equal(ev(`getRevise(${JSON.stringify(k)}).interval`), 1)
})

test('N1: a ✓ on the NEXT day still climbs the ladder and credits again', () => {
  const { ctx, grade, state } = gradedSetup('two-pointers')
  at(ctx.sandbox, 2026, 11, 1, 12); grade('solid')
  at(ctx.sandbox, 2026, 11, 2, 12); grade('solid')
  assert.equal(state().interval, 4)
  assert.equal(state().solves, 2)
})

// ── N2 ─────────────────────────────────────────────────────────────────────────────────────────

test('N2: a later ~ or ✓ recall grade does not clear the must-code flag from ✗', () => {
  const { ctx, ev, k } = gradedSetup('heap')
  const K = JSON.stringify(k)
  ev(`setQuestionStatus(${K}, 'Solved'); markPracticed(${K}); setReviewInterval(${K}, 14)`)
  at(ctx.sandbox, 2026, 11, 1, 12); ev(`gradeRevise(${K}, 'forgot')`)
  assert.equal(ev(`isCodeForced(${K})`), true)
  at(ctx.sandbox, 2026, 11, 2, 12); ev(`gradeRevise(${K}, 'shaky')`)
  assert.equal(ev(`isCodeForced(${K})`), true, '~ recall on the card is not the cold solve the flag asks for')
  assert.equal(ev(`isCodeDue(${K})`), true)
  at(ctx.sandbox, 2026, 11, 3, 12); ev(`gradeRevise(${K}, 'solid')`)
  assert.equal(ev(`isCodeForced(${K})`), true, '✓ recall on the card is not a cold solve either')
})

test('N2: a clean solve (✓ in Graded) clears the must-code flag', () => {
  const { ctx, ev, k, grade } = gradedSetup('heap')
  const K = JSON.stringify(k)
  at(ctx.sandbox, 2026, 11, 1, 12); ev(`gradeRevise(${K}, 'forgot')`)
  at(ctx.sandbox, 2026, 11, 2, 12); grade('solid')
  assert.equal(ev(`isCodeForced(${K})`), false)
})

// ── N3 ─────────────────────────────────────────────────────────────────────────────────────────

function notesApp(sessionStorage) {
  const app = loadAppWithDom()
  app.sandbox.sessionStorage = sessionStorage || makeLocalStorage()
  const ev = code => evalIn(app.sandbox, code)
  ev(`upsertTopicNote('graph', { id: 'a', title: 'A', body: 'old body', pinned: false, updatedAt: 1 })
      upsertTopicNote('graph', { id: 'b', title: 'B', body: 'b', pinned: false, updatedAt: 2 })`)
  const type = (title, body) => {
    app.sandbox.document.getElementById('note-edit-title').value = title
    app.sandbox.document.getElementById('note-edit-body').value = body
  }
  const editorHtml = () => app.getElement('note-editor-host').innerHTML
  return Object.assign(app, { ev, type, editorHtml })
}

test('N3: pinning another note keeps what you typed in the open editor', () => {
  const a = notesApp()
  a.ev(`currentTopicKey = 'graph'; renderTopicNotes(); editTopicNote('a')`)
  a.type('A', 'NEW TYPED DRAFT')
  a.ev(`toggleTopicNotePin('b')`)
  assert.match(a.editorHtml(), /NEW TYPED DRAFT/)
})

test('N3: deleting another note keeps the draft', () => {
  const a = notesApp()
  a.ev(`currentTopicKey = 'graph'; renderTopicNotes(); editTopicNote('a')`)
  a.type('A', 'NEW TYPED DRAFT')
  a.ev(`removeTopicNote('b')`)
  assert.match(a.editorHtml(), /NEW TYPED DRAFT/)
})

test('N3: switching topic and back brings an unsaved draft back (and does not save it)', () => {
  const a = notesApp()
  a.ev(`loadTopic('graph'); renderTopicNotes(); editTopicNote('a')`)
  a.type('A', 'NEW TYPED DRAFT')
  a.ev(`loadTopic('heap')`)
  a.ev(`loadTopic('graph'); renderTopicNotes()`)   // back, then open the Notes tab
  assert.match(a.editorHtml(), /NEW TYPED DRAFT/)
  assert.equal(a.ev(`getTopicNotes('graph').find(n => n.id === 'a').body`), 'old body')
})

// The code a browser would run for the `type` action of the element whose id or class is `hook`
// (data-<type>="name" data-args="[...]", see js/actions.js).
function actionCall(html, hook, type) {
  const tag = (html.match(new RegExp('<[^>]*(?:id|class)="' + hook + '"[^>]*>')) || [])[0]
  if (!tag) return null
  const name = (tag.match(new RegExp('data-' + type + '="([^"]+)"')) || [])[1]
  if (!name) return null
  const raw = (tag.match(/data-args="([^"]*)"/) || [])[1]
  const args = raw ? raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : '[]'
  return `Actions._registry[${JSON.stringify(name)}].apply(null, ${args})`
}

test('N3: a reload restores the draft typed into the editor', () => {
  const session = makeLocalStorage()
  const a = notesApp(session)
  a.ev(`loadTopic('graph'); renderTopicNotes(); editTopicNote('a')`)
  a.type('A', 'TYPED BEFORE RELOAD')
  // Run the editor's own input action, as the browser does on each keystroke.
  const handler = actionCall(a.editorHtml(), 'note-edit-body', 'input')
  assert.ok(handler, 'the note body input saves the draft as you type')
  a.ev(handler)
  const b = notesApp(session)                      // same tab reloaded: new page, same sessionStorage
  b.ev(`loadTopic('graph'); renderTopicNotes()`)
  assert.match(b.editorHtml(), /TYPED BEFORE RELOAD/)
})

test('N3: a per-question note saves while you type, not only on blur', async () => {
  const a = loadAppWithDom()
  const ev = code => evalIn(a.sandbox, code)
  const k = ev(`Object.keys(TOPIC_MODULES.graph.questions)[0]`)
  const html = ev(`buildQuestionAccordionItem(${JSON.stringify(k)}, TOPIC_MODULES.graph.questions[${JSON.stringify(k)}], 'g', 0)`)
  const handler = actionCall(html, 'note-area', 'input')
  assert.ok(handler, 'the note box has an input handler')
  a.sandbox.document.getElementById('note-' + k).value = 'typed, never blurred'
  ev(handler)
  await new Promise(r => setTimeout(r, 1000))
  assert.equal(ev(`getNote(${JSON.stringify(k)})`), 'typed, never blurred')
})

// ── N4 ─────────────────────────────────────────────────────────────────────────────────────────

test('N4: a graded question cycled back to 📋 is not counted in the Pending backlog, and keeps its history', () => {
  const a = loadAppWithDom()
  const ev = code => evalIn(a.sandbox, code)
  const k = JSON.stringify(ev(`Object.keys(TOPIC_MODULES.heap.questions)[0]`))
  const total = ev(`Object.keys(TOPIC_MODULES.heap.questions).length`)
  ev(`currentTopicKey = 'heap'; _psCurrentTopic = 'heap'; _psMode = 'graded'; _psCurrentItems = [[${k}, TOPIC_MODULES.heap.questions[${k}]]]`)
  ev(`_psRecallGrade(${EV}, ${k}, 'solid')`)            // ✓ in Graded → Solved
  assert.equal(ev(`getStatus(${k})`), 'Solved')
  ev(`cycleQuestionStatus(${k})`)                        // Solved → 📋 Pending (on the way to 🚧)
  assert.equal(ev(`getStatus(${k})`), 'Pending')
  ev(`renderTopicTracker(TOPIC_MODULES.heap)`)
  const pending = Number((a.getElement('topic-tracker').innerHTML.match(/📋 <strong>(\d+)<\/strong>/) || [])[1])
  assert.equal(pending, total - 1, 'the topic tracker counts it as worked on, not untouched')
  ev(`loadDashboard()`)
  const allPending = Number((a.getElement('overall-tracker').innerHTML.match(/📋 <strong>(\d+)<\/strong> Pending/) || [])[1])
  assert.equal(allPending, ev(`_uniqueQuestionKeys().size`) - 1, 'dashboard Pending = untouched backlog only')
  assert.equal(ev(`getSolveCount(${k})`), 1, 'passing through 📋 does not wipe the solve count')
})

// ── N5 ─────────────────────────────────────────────────────────────────────────────────────────

test('N5: practice-session keys are synced but are sync noise, not edits', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + require('./load-app').notebookSource()
  const noise = (html.match(/noiseKeys:\s*\[([^\]]*)\]/) || [])[1] || ''
  const { sandbox } = loadApp()
  for (const key of ['dsa-qp-state-v1', 'dsa-practice-session-v1']) {
    assert.ok(evalIn(sandbox, `BACKUP_KEYS.includes(${JSON.stringify(key)})`), key + ' still synced')
    assert.ok(noise.includes(`'${key}'`), key + ' in noiseKeys')
  }
  assert.ok(noise.includes(`'dsa-streak-v1'`))
})

test('per-device keys are not synced: theme and the one-time migration flag', () => {
  const { sandbox } = loadApp()
  for (const key of ['dsa-theme', 'dsa-revise-migrated-v1']) {
    assert.ok(!evalIn(sandbox, `BACKUP_KEYS.includes(${JSON.stringify(key)})`), key + ' must stay on its device')
  }
})

test('N5: a stale second tab re-reads the per-topic session on refocus instead of overwriting it', () => {
  const A = loadAppWithDom(), B = loadAppWithDom()
  B.sandbox.localStorage = A.localStorage                    // one origin, one storage
  const keys = evalIn(A.sandbox, `Object.keys(TOPIC_MODULES['two-pointers'].questions).slice(0, 3)`)
  const setup = `currentTopicKey = 'two-pointers'; _psCurrentTopic = 'two-pointers'; _psMode = 'revise-pattern'
    _psCurrentItems = ${JSON.stringify(keys)}.map(k => [k, TOPIC_MODULES['two-pointers'].questions[k]]); _psSaveSession()`
  evalIn(A.sandbox, setup); evalIn(B.sandbox, setup)
  evalIn(A.sandbox, `_psRecallGrade(${EV}, ${JSON.stringify(keys[0])}, 'solid'); _psRecallGrade(${EV}, ${JSON.stringify(keys[1])}, 'shaky')`)
  B.sandbox.document.hidden = false
  B.fire('visibilitychange')                                  // user switches back to tab B
  evalIn(B.sandbox, `_psRecallGrade(${EV}, ${JSON.stringify(keys[2])}, 'forgot')`)
  const done = JSON.parse(A.localStorage.getItem('dsa-practice-session-v1'))['two-pointers'].doneInSession
  assert.deepEqual([...done].sort(), [...keys].sort(), "tab A's two grades must survive tab B's save")
})

// ── N6 ─────────────────────────────────────────────────────────────────────────────────────────

test('N6: a status change refreshes the nav badge of every topic that lists the question', () => {
  const a = loadAppWithDom()
  const ev = code => evalIn(a.sandbox, code)
  const [k, tA, tB] = ev(`(() => { const seen = {}; for (const t of Object.keys(TOPIC_MODULES)) for (const q of Object.keys(TOPIC_MODULES[t].questions)) { if (seen[q] && seen[q] !== t) return [q, seen[q], t]; seen[q] = t } })()`)
  ev(`loadDashboard()`)                                      // no topic open: a ✓ from the dashboard
  ev(`_psCreditCleanSolve(${JSON.stringify(k)})`)
  for (const t of [tA, tB]) {
    const badge = a.getElement('nav-badge-' + t)
    assert.ok(badge && /^1\//.test(badge.textContent), `badge for ${t} shows the new solve`)
  }
})

// ── N7 ─────────────────────────────────────────────────────────────────────────────────────────

test('N7: restoring a saved session drops questions no longer in the topic', () => {
  const a = loadAppWithDom()
  const real = evalIn(a.sandbox, `Object.keys(TOPIC_MODULES.graph.questions)[0]`)
  a.localStorage.setItem('dsa-practice-session-v1', JSON.stringify({ graph: { mode: 'graded', items: [['LC_DELETED', { title: 'Removed Q', difficulty: 'Hard' }], [real, { title: 'x', difficulty: 'Easy' }]], doneInSession: [] } }))
  evalIn(a.sandbox, `loadTopic('graph')`)
  assert.deepEqual(evalIn(a.sandbox, `_psCurrentItems.map(([k]) => k)`), [real])
})

test('N7: a topic with no saved session opens in the default mode, not the last topic\'s', () => {
  const a = loadAppWithDom()
  evalIn(a.sandbox, `loadTopic('graph'); _psSetMode('recent', 'graph'); loadTopic('heap')`)
  assert.equal(evalIn(a.sandbox, `_psMode`), 'graded')
  evalIn(a.sandbox, `loadTopic('graph')`)
  assert.equal(evalIn(a.sandbox, `_psMode`), 'recent', 'a topic with a saved session keeps its own mode')
})

// ── N8 ─────────────────────────────────────────────────────────────────────────────────────────

test('N8: an expired timer reads 00:00 after a re-render, not the full preset', () => {
  const a = loadAppWithDom()
  evalIn(a.sandbox, `psTimer.total = 300; psTimer.rem = 0; psTimer.sync()`)
  assert.equal(a.getElement('ps-timer-disp').textContent, '00:00')
  const html = evalIn(a.sandbox, `currentTopicKey = 'graph'; _buildPracticePanel('graph', TOPIC_MODULES.graph)`)
  assert.match(html, /id="ps-timer-disp">00:00</)
  evalIn(a.sandbox, `psTimer.total = 0; psTimer.rem = 0; psTimer.sync()`)
  assert.equal(a.getElement('ps-timer-disp').textContent, 'Off', 'no timer set still reads Off')
})
