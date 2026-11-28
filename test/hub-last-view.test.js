'use strict'
// Adi, 2026-11-28: on Binary Search, he clicked System Design, then DSA, and landed on the
// dashboard. Each notebook tab now reopens its own last view. Kept per device (not synced).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadAppWithDom, evalIn, notebookSource } = require('./load-app')

const mode = (sb) => evalIn(sb, 'document.body.dataset.hubMode')
const view = (sb) => evalIn(sb, "localStorage.getItem('dsa-current-view-v1')")

test('DSA → System Design → DSA returns to the topic you were on', () => {
  const { sandbox } = loadAppWithDom()
  evalIn(sandbox, "loadTopic('binary-search')")
  evalIn(sandbox, "switchHub('sd')")
  assert.equal(mode(sandbox), 'sd')
  evalIn(sandbox, "switchHub('dsa')")
  assert.equal(mode(sandbox), 'dsa')
  assert.equal(view(sandbox), 'binary-search')
  assert.equal(evalIn(sandbox, 'currentTopicKey'), 'binary-search')
})

test('each tab keeps its own last view', () => {
  const { sandbox } = loadAppWithDom()
  evalIn(sandbox, "switchHub('sd')")
  evalIn(sandbox, "loadEmbed('papers')")
  evalIn(sandbox, "loadRecent()")
  evalIn(sandbox, "switchHub('sd')")
  assert.equal(view(sandbox), 'papers')
  evalIn(sandbox, "switchHub('dsa')")
  assert.equal(view(sandbox), 'recent')
})

test('a shared page reopens in the tab it was left in', () => {
  const { sandbox } = loadAppWithDom()
  evalIn(sandbox, "switchHub('sd')")
  evalIn(sandbox, "loadEmbed('sites')")
  evalIn(sandbox, "switchHub('exp')")
  evalIn(sandbox, "switchHub('sd')")
  assert.equal(mode(sandbox), 'sd')
  assert.equal(view(sandbox), 'sites')
})

test('a tab with no memory (or a stale one) opens its home page', () => {
  const { sandbox } = loadAppWithDom({ 'dsa-hub-last-view-v1': '{"dsa":"gone-topic"}' })
  evalIn(sandbox, "switchHub('dsa')")
  assert.equal(view(sandbox), 'dashboard')
  evalIn(sandbox, "switchHub('exp')")
  assert.equal(view(sandbox), 'google')
})

test('the last-view memory stays on this device', () => {
  const backup = notebookSource().match(/BACKUP_KEYS\s*=\s*\[[\s\S]*?\]/)
  assert.ok(backup, 'BACKUP_KEYS found')
  assert.doesNotMatch(backup[0], /dsa-hub-last-view-v1/)
})
