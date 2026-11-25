'use strict'
// Adi, 2026-11-25: with Sign in with GitHub, sync is automatic, so the Export, Import, Sync,
// Pull and Token buttons are gone from all three apps. What replaces them: every app checks
// the cloud on each open and when the person returns to the tab (sync-races.test.js has the
// behaviour test for onReturn), and edits upload by themselves.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')

for (const f of ['index.html', 'apps/habits.html', 'apps/gym-5day.html']) {
  test(`${f}: only the account button is left, and the cloud is checked on open and on return`, () => {
    const html = read(f)
    assert.match(html, /id="dataAccountBtn"/)
    for (const gone of ['DataSync.syncNow()', 'DataSync.pullLatest()', 'DataSync.setToken()', 'exportData()', 'import-file-input']) {
      assert.ok(!html.includes(gone), `${f} still has ${gone}`)
    }
    assert.match(html, /DataSync\.autoSync\(\{ everyOpen: true, onReturn: true \}\)/)
  })
}

test('the hub is named Interview Prep Hub', () => {
  const html = read('index.html')
  assert.match(html, /<title>Interview Prep Hub<\/title>/)
  assert.match(html, /class="sidebar-footer">[\s\S]*?<span>v\d+ · Interview Prep Hub<\/span>/)
  assert.equal(JSON.parse(read('manifest.json')).name, 'Interview Prep Hub')
})
