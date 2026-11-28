'use strict'
// js/dates.js is the one home of "which local day is it" for all three apps.
process.env.TZ = 'Asia/Kolkata'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const sandbox = { Date }
vm.createContext(sandbox)
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'dates.js'), 'utf8'), sandbox)
const { LocalDate } = sandbox

test('key() is the local day, so 00:30 IST is already the new day', () => {
  assert.strictEqual(LocalDate.key(new Date('2026-11-15T19:00:00Z')), '2026-11-16')
  assert.strictEqual(LocalDate.key(new Date('2026-01-05T12:00:00Z')), '2026-01-05')
})

test('addDays() moves by calendar days and does not change its input', () => {
  const d = new Date('2026-03-01T06:00:00Z')
  assert.strictEqual(LocalDate.key(LocalDate.addDays(d, -1)), '2026-02-28')
  assert.strictEqual(LocalDate.key(LocalDate.addDays(d, 31)), '2026-04-01')
  assert.strictEqual(LocalDate.key(d), '2026-03-01')
})

test('every page that uses LocalDate loads js/dates.js first, and its service worker caches it', () => {
  for (const [page, sw] of [['index.html', 'sw.js'], ['apps/habits.html', 'apps/habits-sw.js'], ['apps/gym-5day.html', null]]) {
    // index.html's own code is in js/notebook/*.js
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8') + (page === 'index.html' ? require('./load-app').notebookSource() : '')
    assert.match(html, /LocalDate\./, page + ' uses LocalDate')
    const tags = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1])
    const i = tags.findIndex(s => s.endsWith('js/dates.js'))
    assert.ok(i >= 0, page + ' loads js/dates.js')
    assert.ok(i < tags.findIndex(s => s.endsWith('js/sync.js')), page + ' loads dates.js before sync.js')
    if (sw) assert.match(fs.readFileSync(path.join(ROOT, sw), 'utf8'), /js\/dates\.js/, sw + ' caches dates.js')
  }
})
