'use strict'
// Regression test from the 2026-11-16 audit. A bad value from an import or the gist.
// importData (index.html) and sync's writeKeys (js/sync.js) only check that a value is a
// string. The string "null" is valid JSON, so data.js's loadProgress/loadNotes/... cache
// `null` (`try { JSON.parse(...) } catch { {} }` only catches parse errors), and every
// getStatus()/getNote() does null[lcKey] and throws. The notebook then fails to render.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('importing a backup whose dsa-progress-v1 is "null" must not break the notebook', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => d.accept())
    await page.goto(base + '/index.html')
    const file = path.join(os.tmpdir(), 'tracker-test-null-backup.json')
    fs.writeFileSync(file, JSON.stringify({ 'dsa-progress-v1': 'null' }))
    await Promise.all([page.waitForNavigation(), page.setInputFiles('#import-file-input', file)])
    await page.waitForLoadState('load')
    await page.waitForTimeout(300)
    let topicErr = null
    try { await page.evaluate(() => loadTopic('two-pointers')) } catch (e) { topicErr = e.message }
    assert.deepEqual(errors, [], 'page threw on boot after import')
    assert.equal(topicErr, null, 'opening a topic threw')
  } finally { await browser.close(); server.close() }
})
