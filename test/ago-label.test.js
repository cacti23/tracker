'use strict'
// The Recent log's "when": a grade from seconds ago read "just now ago".
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn } = require('./load-app')

test('Recent rows say how long ago in plain words', () => {
  const { sandbox } = loadApp()
  const ago = mins => evalIn(sandbox, `_agoLabel(new Date(Date.now() - ${mins} * 60000).toISOString())`)
  assert.equal(ago(0), 'just now')
  assert.equal(ago(5), '5 min ago')
  assert.equal(ago(180), '3h ago')
  assert.equal(ago(3 * 24 * 60), '3d ago')
  assert.equal(evalIn(sandbox, `_agoLabel(null)`), '')
})

test('a row graded a moment ago reads "just now", not "just now ago"', () => {
  const { sandbox } = loadApp()
  const k = evalIn(sandbox, `Object.keys(TOPIC_MODULES.trees.questions)[0]`)
  evalIn(sandbox, `logRecent(${JSON.stringify(k)}, 'solid')`)
  const html = evalIn(sandbox, `_buildRecentItem([${JSON.stringify(k)}, TOPIC_MODULES.trees.questions[${JSON.stringify(k)}]], 0)`)
  assert.match(html, />just now<\/span>/)
  assert.doesNotMatch(html, /just now ago/)
})
