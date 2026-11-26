'use strict'
// Opening the DSA dashboard (and switching back to it from System Design) asked every question
// for its solve count, revise record and code-force flag, and each ask re-parsed that whole
// localStorage map. With a few hundred practised questions that was most of a second of JSON.parse.
const test = require('node:test')
const assert = require('node:assert')
const { loadAppWithDom, evalIn } = require('./load-app')

function seeded() {
  const app = loadAppWithDom()
  const keys = evalIn(app.sandbox, 'Object.values(TOPIC_MODULES).flatMap(m => Object.keys(m.questions)).slice(0, 300)')
  const last = new Date(Date.now() - 3 * 864e5).toISOString()
  const map = f => JSON.stringify(Object.fromEntries(keys.map(k => [k, f(k)])))
  app.localStorage.setItem('dsa-solve-counts-v1', map(() => 2))
  app.localStorage.setItem('dsa-revise-v1', map(() => ({ interval: 2, last, grade: 'solid' })))
  app.localStorage.setItem('dsa-code-force-v1', map(() => true))
  app.localStorage.setItem('dsa-review-interval-v1', map(() => 4))
  app.localStorage.setItem('dsa-last-practiced-v1', map(() => last))
  return { ...app, keys }
}

test('the dashboard parses each practice map once, not once per question', () => {
  const { sandbox } = seeded()
  let parses = 0
  const realParse = JSON.parse
  sandbox.JSON = { parse: (...a) => { parses++; return realParse(...a) }, stringify: JSON.stringify }
  evalIn(sandbox, 'loadDashboard()')
  assert.ok(parses < 50, `loadDashboard ran JSON.parse ${parses} times`)
})

test('a write from another tab or a sync is still seen on the next read', () => {
  const { sandbox, localStorage, keys } = seeded()
  const k = keys[0]
  assert.strictEqual(sandbox.getSolveCount(k), 2)
  assert.strictEqual(sandbox.getRevise(k).grade, 'solid')
  assert.strictEqual(sandbox.isCodeForced(k), true)
  localStorage.setItem('dsa-solve-counts-v1', JSON.stringify({ [k]: 7 }))
  localStorage.setItem('dsa-revise-v1', JSON.stringify({ [k]: { interval: 1, last: new Date().toISOString(), grade: 'forgot' } }))
  localStorage.removeItem('dsa-code-force-v1')
  assert.strictEqual(sandbox.getSolveCount(k), 7)
  assert.strictEqual(sandbox.getRevise(k).grade, 'forgot')
  assert.strictEqual(sandbox.isCodeForced(k), false)
})

test('grading twice on one day still rewinds to the first grade (base is not shared)', () => {
  const { sandbox, keys } = seeded()
  const k = keys[1]
  sandbox.gradeRevise(k, 'solid')
  const after1 = sandbox.getSolveCount(k)
  sandbox.gradeRevise(k, 'forgot')
  assert.strictEqual(sandbox.getSolveCount(k), after1 - 1, 'the ✓ credit is taken back')
  sandbox.gradeRevise(k, 'solid')
  assert.strictEqual(sandbox.getSolveCount(k), after1, 'and given again once, not twice')
})
