'use strict'
// The 2026-11 dashboard redesign: the Today panel, the first-run welcome, the folded key idea,
// and proof that rendering the new UI never rewrites what a returning user already has saved.
//
// Run with: node --test test/ui-overhaul.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString()

// A returning user's storage, one value per synced key, in the shapes the app writes today.
const FIXTURE = {
  'dsa-progress-v1': { LC_1: { status: 'Solved' }, LC_167: { status: 'Solved' }, LC_15: { status: 'In Progress' }, LC_56: { status: 'Solved' } },
  'dsa-notes-v1': { LC_1: 'Hash map of value to index, one pass.' },
  'dsa-topic-notes-v1': { 'two-pointers': [{ id: 'n1', title: 'Converging', body: 'Move the side that can improve.' }] },
  'dsa-submissions-v1': { LC_1: ['https://leetcode.com/submissions/detail/1/'] },
  'dsa-animations-v1': { LC_15: 'https://example.com/3sum-anim' },
  'dsa-pins-v1': { LC_1: true },
  'dsa-question-pins-v1': { LC_15: true },
  'dsa-solve-counts-v1': { LC_1: 3, LC_167: 1, LC_56: 2 },
  'dsa-seen-v1': { LC_1: ago(20) },
  'dsa-revise-v1': { LC_1: { interval: 1, last: ago(3), grade: 'shaky' }, LC_167: { interval: 4, last: ago(1), grade: 'solid' } },
  'dsa-code-force-v1': { LC_56: true },
  'dsa-revise-migrated-v1': '1',
  'dsa-recent-log-v1': [{ k: 'LC_1', g: 'shaky', t: ago(3) }],
  'dsa-last-practiced-v1': { LC_1: ago(3), LC_167: ago(1), LC_56: ago(9) },
  'dsa-review-interval-v1': { LC_1: 3, LC_56: 1 },
  'dsa-qp-state-v1': { topics: ['two-pointers'], count: 5 },
  'dsa-practice-session-v1': { 'two-pointers': { mode: 'graded' } },
  'paper-club-v1': { read: ['raft'] },
}
const seedOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))

test('rendering the dashboard and every topic leaves a returning user\'s synced data byte-for-byte unchanged', () => {
  const seed = seedOf(FIXTURE)
  const { sandbox, localStorage } = loadAppWithDom(seed)
  const ev = (c) => evalIn(sandbox, c)
  ev('loadDashboard()')
  for (const key of ev('TOPICS.map(t => t.key)')) ev(`loadTopic(${JSON.stringify(key)})`)
  ev('loadDashboard()')
  ev('_dashOpenRevision()')
  for (const [k, v] of Object.entries(seed)) {
    if (k === 'dsa-qp-state-v1') continue  // Quick Practice saves its own UI state when a set is generated (an action, not a render)
    assert.equal(localStorage.getItem(k), v, `${k} must not change shape or value`)
  }
})

test('Today shows the revision-due count from the revise queue and lists the weakest first', () => {
  const { sandbox, getElement } = loadAppWithDom(seedOf(FIXTURE))
  const ev = (c) => evalIn(sandbox, c)
  ev('loadDashboard()')
  const html = getElement('overall-tracker').innerHTML
  const due = ev('[..._uniqueQuestionKeys()].filter(k => isReviseDue(k)).length')
  assert.ok(due > 0)
  assert.match(html, new RegExp(`id="due-revise-count">${due}<`), 'the highlighted number is the real due count')
  const titles = [...html.matchAll(/class="dash-due-item"[^>]*>([^<]+)</g)].map(m => m[1])
  assert.equal(titles[0], ev(`TOPIC_MODULES.sorting.questions.LC_56.title`), '✗ forgot (code-forced) comes first')
  assert.equal(titles[1], 'Two Sum', '~ shaky comes next')
  assert.match(html, /📋 <strong>\d+<\/strong> Pending/)
  assert.match(html, /id="due-code-count"/)
})

test('a brand-new user sees the welcome steps; the first solve retires it with no stored flag', () => {
  const { sandbox, getElement, localStorage } = loadAppWithDom()
  const ev = (c) => evalIn(sandbox, c)
  ev('loadDashboard()')
  const welcome = getElement('dash-welcome').innerHTML
  assert.match(welcome, /Start with Two Pointers/)
  assert.match(welcome, /Sign in with GitHub/)
  assert.match(getElement('overall-tracker').innerHTML, /Nothing to revise yet/)
  const keysBefore = localStorage.length
  ev(`setStatus('LC_1', 'Solved')`)
  assert.equal(localStorage.length, keysBefore + 1, 'only the progress write itself, no welcome flag')
  ev('loadDashboard()')
  assert.equal(getElement('dash-welcome').innerHTML, '')
})

test('the welcome hides the sign-in button once sync is set up', () => {
  const { sandbox, getElement } = loadAppWithDom({ 'tracker-sync-token': 'gho_test' })
  evalIn(sandbox, 'loadDashboard()')
  assert.doesNotMatch(getElement('dash-welcome').innerHTML, /<button[^>]*DataSync\.account/)
})

test('the question of the day keeps its key idea folded, so the answer is not shown by default', () => {
  const { sandbox } = loadAppWithDom()
  const html = evalIn(sandbox, `renderDailyQuestionCard({ topicKey: 'two-pointers', topicLabel: 'Two Pointers', topicIcon: '👉', lcKey: 'LC_1', status: 'Pending', question: { title: 'Two Sum <x>', difficulty: 'Easy', freq: 'High', keyInsight: 'Use a map <b>' } })`)
  assert.match(html, /<details class="dash-hint"><summary>Show the key idea<\/summary><p>Use a map &lt;b&gt;<\/p><\/details>/)
  assert.match(html, /Two Sum &lt;x&gt;/)
})

test('design tokens: every text colour token is defined for both themes, and no font size is below 12px', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + require('./load-app').notebookSource()
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'hub.css'), 'utf8')   // the one token source
  assert.match(html, /<link rel="stylesheet" href="css\/hub\.css">/)
  const block = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)))
  const dark = block(':root {'), light = block(':root[data-theme="light"] {')
  for (const t of ['--text-primary', '--text-muted', '--text-faint', '--accent', '--green', '--yellow', '--red', '--highlight', '--on-accent']) {
    assert.match(dark, new RegExp(t + ':'), `${t} in dark`)
    assert.match(light, new RegExp(t + ':'), `${t} in light`)
  }
  const tiny = [...html.matchAll(/font-size:\s*([0-9.]+)(rem|px)/g)].filter(m => (m[2] === 'px' ? +m[1] : +m[1] * 16) < 12)
  assert.deepEqual(tiny.map(m => m[0]), [], 'use the --fs-* scale (smallest 12px)')
})

test('a long topic name truncates in the sidebar so its count badge stays inside', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + require('./load-app').notebookSource() + fs.readFileSync(path.join(__dirname, '..', 'css', 'notebook.css'), 'utf8')  // the page's CSS lives in css/notebook.css
  assert.match(html, /\.nav-topic-label \{[^}]*min-width: 0;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/)
  assert.match(html, /#sidebar \.nav-link \.badge \{ flex-shrink: 0; \}/)
  assert.match(html, /class="nav-link" title="\$\{escHtml\(t\.label\)\}"/, 'the full name stays available on hover')
})
