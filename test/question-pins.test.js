'use strict'
// 📌 Question pins are a bookmark only: they fill the topic's Pinned list and nothing else.
// Run with: node --test test/question-pins.test.js

const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn } = require('./load-app')

let ctx
beforeEach(() => { ctx = loadApp() })
const ev = code => evalIn(ctx.sandbox, code)
const enterTopic = topic => ev(`currentTopicKey = ${JSON.stringify(topic)}; _psCurrentItems = []; _psCurrentTopic = null; _psClearedTopics = new Set()`)
const treeKeys = n => ev(`Object.keys(TOPIC_MODULES.trees.questions).slice(0, ${n})`)

test('toggle pins and unpins, and touches no other key', () => {
  const [k] = treeKeys(1)
  const before = JSON.stringify(Object.keys(ctx.sandbox.localStorage._dump()).filter(x => x !== 'dsa-question-pins-v1'))
  assert.equal(ev(`toggleQuestionPin('${k}')`), true)
  assert.equal(ev(`isQuestionPinned('${k}')`), true)
  assert.equal(ev(`toggleQuestionPin('${k}')`), false)
  assert.equal(ev(`isQuestionPinned('${k}')`), false)
  const after = JSON.stringify(Object.keys(ctx.sandbox.localStorage._dump()).filter(x => x !== 'dsa-question-pins-v1'))
  assert.equal(after, before)
})

test('Pinned mode shows every pinned question of the topic, in topic order, and keeps the count', () => {
  const keys = treeKeys(4)
  ev(`toggleQuestionPin('${keys[3]}'); toggleQuestionPin('${keys[1]}')`)
  enterTopic('trees')
  ev(`_psQCount = 7; _psMode = 'graded'; _psSetMode('pinned', 'trees')`)
  assert.deepEqual(ev('_psCurrentItems.map(([k]) => k)'), [keys[1], keys[3]])
  assert.equal(ev('_psQCount'), 7, 'switching to Pinned must not change the count the other modes use')
  assert.match(ev(`_buildPracticePanel('trees', TOPIC_MODULES.trees)`), /📌 2 pinned/)
})

test('pins never enter Graded or the dashboard generator', () => {
  const [k] = treeKeys(1)
  ev(`toggleQuestionPin('${k}')`)
  enterTopic('trees')
  ev(`_psMode = 'graded'`)
  assert.equal(ev(`_psModePool('trees', 50).length`), 0, 'nothing graded yet, so Graded stays empty even with a pin')
  ev(`setStatus('${k}', 'Solved'); markPracticed('${k}'); bumpReviewInterval('${k}')`)
  ev(`_qpTopics = new Set(['trees']); _qpRevised = false; _qpMock = false; _qpCount = 50; _qpGenerate()`)
  assert.ok(!ev(`_qpResults.map(([x]) => x).includes('${k}')`), 'a pin must not pull a resting question into the set')
})

test('Pinned mode survives a reload and stays live', () => {
  const keys = treeKeys(2)
  ev(`toggleQuestionPin('${keys[0]}')`)
  enterTopic('trees')
  ev(`_psMode = 'graded'; _buildPracticePanel('trees', TOPIC_MODULES.trees); _psSetMode('pinned', 'trees')`)
  ev(`toggleQuestionPin('${keys[1]}')`)                 // pinned on a card after the list was built
  enterTopic('trees'); ev(`_psMode = 'graded'`)         // simulate a reload
  ev(`_buildPracticePanel('trees', TOPIC_MODULES.trees)`)
  assert.equal(ev('_psMode'), 'pinned')
  assert.deepEqual(ev('_psCurrentItems.map(([k]) => k)'), keys)
})

test('pins sync with the rest of the data', () => {
  assert.ok(ev(`BACKUP_KEYS.includes('dsa-question-pins-v1')`))
})
