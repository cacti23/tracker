'use strict'
// Adi, 2026-11-26: a simple place that lists what he graded (✓ ~ ✗), newest first, so he can see
// the order he solved them in and find one again later. It reads the revise records, which keep
// each question's latest grade and when, so older grades show up too and nothing new is stored.
const test = require('node:test')
const assert = require('node:assert')
const { loadAppWithDom, evalIn, nQuestions } = require('./load-app')

function seeded() {
  const probe = loadAppWithDom()
  const [a, b, c] = nQuestions(probe.sandbox, 'two-pointers', 3)
  const now = Date.now()
  const rev = {
    [a]: { interval: 2, last: new Date(now - 3 * 864e5).toISOString(), grade: 'forgot' },
    [b]: { interval: 4, last: new Date(now - 60e3).toISOString(), grade: 'solid' },
    [c]: { interval: 2, last: new Date(now - 3600e3).toISOString(), grade: 'shaky' },
    LC_NOT_IN_ANY_TOPIC: { interval: 1, last: new Date(now).toISOString(), grade: 'solid' },
  }
  const app = loadAppWithDom({ 'dsa-revise-v1': JSON.stringify(rev) })
  return { ...app, a, b, c }
}

test('lists graded questions newest first, with their grade', () => {
  const { sandbox, a, b, c } = seeded()
  const order = JSON.parse(evalIn(sandbox, 'JSON.stringify(_recentlySolved().map(e => [e.lcKey, e.grade]))'))
  assert.deepStrictEqual(order, [[b, 'solid'], [c, 'shaky'], [a, 'forgot']])
})

test('the view groups by day and opens the question in its topic', () => {
  const { sandbox, getElement, a } = seeded()
  evalIn(sandbox, 'loadRecent()')
  const html = getElement('view-recent').innerHTML
  assert.match(html, /<h3 class="recent-day">Today<\/h3>/)
  assert.strictEqual((html.match(/class="recent-day"/g) || []).length, 2, 'today + 3 days ago')
  assert.strictEqual((html.match(/class="ps-q-row recent-row"/g) || []).length, 3, 'unknown keys are skipped')
  assert.ok(html.includes('goToQuestion(&quot;two-pointers&quot;, &quot;' + a + '&quot;)'))
  assert.match(html, /3 graded · <span class="rg-solid">✓ 1<\/span> <span class="rg-shaky">~ 1<\/span> <span class="rg-forgot">✗ 1<\/span>/)
})

test('a fresh grade moves the question to the top', () => {
  const { sandbox, a } = seeded()
  evalIn(sandbox, `gradeRevise(${JSON.stringify(a)}, 'shaky')`)
  assert.strictEqual(evalIn(sandbox, '_recentlySolved()[0].lcKey'), a)
})

test('it has a sidebar entry in the DSA notebook, and a reload returns to it', () => {
  const { sandbox } = seeded()
  evalIn(sandbox, 'loadRecent()')
  assert.strictEqual(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'recent')
  const again = loadAppWithDom({ 'dsa-current-view-v1': 'recent' })
  assert.strictEqual(again.getElement('page-title').textContent, '🕘 Recently solved')
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')
  assert.match(html, /id="nav-recent" data-hub="dsa" onclick="loadRecent\(\)"/)
})

test('with nothing graded it says how to start', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, 'loadRecent()')
  assert.match(getElement('view-recent').innerHTML, /Nothing graded yet/)
})
