'use strict'
// Engineering audit 2026-11-25. importData took a snapshot (rotating dsa-presync → -2 → -3)
// before it checked the file. A file holding JSON null, or no known keys at all, still rotated
// the snapshots: the oldest undo copy was thrown away and nothing was imported. Two bad tries
// in a row pushed out two of the three copies a sync keeps for recovery.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startServer, openBrowser, SKIP } = require('./prod-server')

for (const [name, content] of [['JSON null', 'null'], ['no known keys', '{"something-else": "x"}']]) {
  test('a backup file with ' + name + ' leaves the undo snapshots alone', { skip: SKIP }, async () => {
    const { server, base } = await startServer()
    const { browser, context } = await openBrowser()
    try {
      const page = await context.newPage()
      const failed = new Promise(res => page.on('dialog', d => { const m = d.message(); d.accept(); res(m) }))
      await page.goto(base + '/index.html')
      await page.evaluate(() => {
        localStorage.setItem('dsa-presync', '{"savedAt":"1","data":{}}')
        localStorage.setItem('dsa-presync-2', '{"savedAt":"2","data":{}}')
        localStorage.setItem('dsa-presync-3', '{"savedAt":"3","data":{}}')
      })
      const file = path.join(os.tmpdir(), 'tracker-test-bad-backup-' + process.pid + '-' + name.replace(/\W/g, '') + '.json')
      fs.writeFileSync(file, content)
      await page.setInputFiles('#import-file-input', file)
      assert.match(await failed, /Import failed/)
      const snaps = await page.evaluate(() => ['dsa-presync', 'dsa-presync-2', 'dsa-presync-3'].map(k => JSON.parse(localStorage.getItem(k)).savedAt))
      assert.deepEqual(snaps, ['1', '2', '3'])
    } finally { await browser.close(); server.close() }
  })
}
