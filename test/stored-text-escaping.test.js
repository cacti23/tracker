'use strict'
// Stored text must render as text in the gym app (the habits case is a control).
// apps/gym-5day.html interpolates stored, user-typed and gist-synced text (day notes, exercise
// notes, set weight/reps, history dates/sets) straight into innerHTML templates. A day note
// containing "</textarea>" ends the textarea and the rest is parsed as markup; under the
// production CSP (unsafe-inline) an inline handler in it ran before the fix.
// The habits control test passes: habits renders names with textContent.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

const HANDLER = `window.__pwned=1`

test('gym: a stored day note must render as text, not markup', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    page.on('dialog', d => d.accept())
    await page.goto(base + '/apps/gym-5day.html')
    await page.evaluate(h => {
      localStorage.setItem('gym5day_data', JSON.stringify({ 0: { notes: 'felt good </textarea><img src=nope onerror="' + h + '">' } }))
      localStorage.setItem('gym5day_nav', JSON.stringify({ activeDayIndex: 0, currentTab: 'split', currentWeek: 'A' }))
    }, HANDLER)
    await page.reload()
    await page.waitForTimeout(500)
    const notes = await page.evaluate(() => document.getElementById('dayNotes') && document.getElementById('dayNotes').value)
    assert.equal(await page.evaluate(() => !!window.__pwned), false, 'stored note ran as script')
    assert.match(notes || '', /<\/textarea>/, 'the note text was truncated at "</textarea>"')
  } finally { await browser.close(); server.close() }
})

test('habits (control, passes): a stored habit name renders as text', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    await page.goto(base + '/apps/habits.html')
    await page.evaluate(h => {
      localStorage.setItem('habits_data_v1', JSON.stringify({ habits: [{ id: 'h1', name: '<img src=nope onerror="' + h + '">', color: '#ff0000', emoji: 'x', slot: '', mon: 0 }], logs: {} }))
    }, HANDLER)
    await page.reload()
    await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => !!window.__pwned), false)
    assert.match(await page.evaluate(() => document.querySelector('.habit-name').textContent), /<img/)
  } finally { await browser.close(); server.close() }
})
