'use strict'
// Two tabs of the same app (before the fix, the stale one erased the other's edits).
// habits.html keeps `state` and gym-5day.html keeps `userData` in memory from page load and
// write the WHOLE object back on every save; neither listens for `storage` events. A tab opened
// earlier therefore overwrites whatever another tab (or another tab's sync pull/merge, which
// only reloads ITS OWN tab) stored since. Its write is then recorded as an edit and uploaded,
// so the loss propagates to every device. (data.js invalidates its caches on `storage`; the
// apps don't.)
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('habits: a stale second tab must not erase a habit added in the first tab', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const seed = JSON.stringify({ habits: [{ id: 'h_old', name: 'Read', color: '#ff6b6b', emoji: 'x', slot: '', mon: 0 }], logs: {} })
    const a = await context.newPage()
    await a.goto(base + '/apps/habits.html')
    await a.evaluate(s => localStorage.setItem('habits_data_v1', s), seed)
    await a.reload()
    const b = await context.newPage()
    await b.goto(base + '/apps/habits.html')

    // Tab A: add a habit through the real modal.
    await a.evaluate(() => { openAddModal(); document.getElementById('habitNameInput').value = 'Meditate'; saveHabit() })
    // Tab B (loaded before the add): tick today on the old habit.
    await b.click('.dot.today')

    const stored = await a.evaluate(() => JSON.parse(localStorage.getItem('habits_data_v1')))
    const names = stored.habits.map(h => h.name)
    assert.ok(names.includes('Meditate'), 'habit added in tab A was overwritten by tab B: ' + JSON.stringify(names))
  } finally { await browser.close(); server.close() }
})

test('gym: a stale second tab must not erase a day note typed in the first tab', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const a = await context.newPage()
    await a.goto(base + '/apps/gym-5day.html')
    const b = await context.newPage()
    await b.goto(base + '/apps/gym-5day.html')
    await a.evaluate(() => window.setExerciseNotes(0, 0, 'tab A note'))
    await b.evaluate(() => window.setExerciseNotes(0, 1, 'tab B note'))
    const stored = await a.evaluate(() => localStorage.getItem('gym5day_data'))
    assert.match(stored, /tab A note/, 'tab A edit lost: ' + stored)
  } finally { await browser.close(); server.close() }
})
