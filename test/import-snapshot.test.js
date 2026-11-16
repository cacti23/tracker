'use strict'
// Regression test from the 2026-11-16 audit. A backup import.
// importData (index.html) overwrites every BACKUP_KEYS entry present in the file with no copy
// of what was there. Sync snapshots before every write (snapshotLocal -> dsa-presync, -2, -3);
// import doesn't, so importing the wrong/older file (or a hostile one) destroys the current
// data on this device with no way back — for a device with no token there is no cloud copy
// either, and with a token the import is uploaded after the reload (it counts as an edit).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('importing a backup keeps a recoverable copy of the data it replaces', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    page.on('dialog', d => d.accept())
    await page.goto(base + '/index.html')
    await page.evaluate(() => localStorage.setItem('dsa-notes-v1', JSON.stringify({ LC_167: 'PRECIOUS-CURRENT-NOTE' })))
    const file = path.join(os.tmpdir(), 'tracker-test-old-backup.json')
    fs.writeFileSync(file, JSON.stringify({ 'dsa-notes-v1': JSON.stringify({ LC_167: 'old note' }) }))
    await Promise.all([page.waitForNavigation(), page.setInputFiles('#import-file-input', file)])
    await page.waitForLoadState('load')
    const copies = await page.evaluate(() => Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').includes('PRECIOUS-CURRENT-NOTE')))
    assert.ok(copies.length > 0, 'the replaced data survives nowhere in localStorage')
  } finally { await browser.close(); server.close() }
})
