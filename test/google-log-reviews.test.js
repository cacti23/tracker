'use strict'
// The Google log's per-experience review counter writes two localStorage keys from
// google/google-onsite-log.html. They only reach other devices if index.html syncs them.
// Run with: node --test test/google-log-reviews.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadApp, evalIn } = require('./load-app')

const log = fs.readFileSync(path.join(__dirname, '..', 'google', 'google-onsite-log.html'), 'utf8')
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

test('review counter keys are synced, and the count keeps the larger value on a conflict', () => {
  const ctx = loadApp()
  for (const key of ['google-log-reviews-v1', 'google-log-reviewed-at-v1']) {
    assert.ok(log.includes(`'${key}'`), `log page writes ${key}`)
    assert.ok(evalIn(ctx.sandbox, `BACKUP_KEYS.includes('${key}')`), `${key} is in BACKUP_KEYS`)
  }
  const init = index.slice(index.indexOf('DataSync.init('), index.indexOf('DataSync.autoSync()'))
  assert.match(init, /maxKeys:[^\n]*'google-log-reviews-v1'/)
})
