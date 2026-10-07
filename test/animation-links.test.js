'use strict'
// Per-question animation link (a claude.ai artifact opened from the 🎬 button in the question row).
// Run with: node --test test/animation-links.test.js
const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp, evalIn } = require('./load-app')

let ctx
beforeEach(() => { ctx = loadApp() })
const ev = code => evalIn(ctx.sandbox, code)

test('only https claude.ai artifact pages are accepted', () => {
  const ok = ['https://claude.ai/artifact/6vLL4KH4peDATY2sdEi78y', 'https://claude.ai/public/artifacts/abc-123']
  const bad = ['http://claude.ai/artifact/x', 'https://claude.ai/', 'https://claude.ai/chat/abc', 'https://claude.ai.evil.com/artifact/x',
    'https://evil.com/claude.ai/artifact/x', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', '']
  ok.forEach(u => assert.equal(ev(`_isSafeAnimationUrl(${JSON.stringify(u)})`), true, u))
  bad.forEach(u => assert.equal(ev(`_isSafeAnimationUrl(${JSON.stringify(u)})`), false, u))
})

test('save, replace and remove keep one link per question and touch nothing else', () => {
  ev(`addSubmission('LC_1192', 'https://leetcode.com/problems/x/submissions/1/')`)
  ev(`setAnimation('LC_1192', 'https://claude.ai/artifact/aaa')`)
  ev(`setAnimation('LC_1192', 'https://claude.ai/artifact/bbb')`)
  assert.equal(ev(`getAnimation('LC_1192').url`), 'https://claude.ai/artifact/bbb')
  assert.equal(ev(`Object.keys(loadAnimations()).length`), 1)
  assert.equal(ev(`getSubmissions('LC_1192').length`), 1, 'submission links are separate')
  ev(`removeAnimationAt('LC_1192')`)
  assert.equal(ev(`getAnimation('LC_1192')`), null)
})

test('the animation key is exported, imported and synced with the rest', () => {
  assert.ok(ev(`BACKUP_KEYS.includes('dsa-animations-v1')`))
})

test('the 🎬 button is lit when a link is saved and dim otherwise, and a tampered link never becomes an href', () => {
  assert.match(ev(`_animBtnHtml('LC_1192')`), /qa-ghost/)
  ev(`setAnimation('LC_1192', 'https://claude.ai/artifact/aaa')`)
  assert.match(ev(`_animBtnHtml('LC_1192')`), /has-subs/)
  ev(`setAnimation('LC_1192', 'javascript:alert(1)')`)   // e.g. from a tampered synced payload
  const row = ev(`_animRowHtml('LC_1192')`)
  assert.doesNotMatch(row, /href=/)
  assert.match(row, /Blocked/)
})
