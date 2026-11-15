'use strict'
// Habits left open across midnight. Every "today" highlight and streak in
// apps/habits.html is computed at render time, so before the fix a page (or
// installed PWA) left open past midnight kept highlighting yesterday as today,
// and tapping that dot toggled yesterday, which could untick it and break the
// streak. These tests boot the real page in Chromium with a faked clock.
//
// Needs Playwright with a Chromium build; skipped (not failed) when it isn't
// installed, so the suite stays runnable anywhere. No network: the repo is
// served by an in-process static server and external requests are aborted.
//
// Run with: node --test test/habits-midnight.test.js

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const KEY = 'habits_data_v1'
const SEED = {
  habits: [{ id: 'h1', name: 'Run', color: '#e05a2b', mon: 0 }],
  logs: { h1: { '2026-11-14': true, '2026-11-15': true } },
}

let chromium = null
try { chromium = require('playwright').chromium } catch (e) {}

let server, base, browser, skipReason = null

before(async () => {
  if (!chromium) { skipReason = 'playwright not installed'; return }
  try { browser = await chromium.launch() } catch (e) { skipReason = 'chromium unavailable: ' + e.message.split('\n')[0]; return }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' }
  server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (browser) await browser.close()
  if (server) await new Promise(r => server.close(r))
})

// Opens habits at 23:58 on Nov 15 with Run done on the 14th and 15th.
async function openBeforeMidnight() {
  const ctx = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'UTC' })
  await ctx.route(url => !url.href.startsWith(base), r => r.abort())
  const page = await ctx.newPage()
  await page.clock.install({ time: new Date('2026-11-15T23:58:00Z') })
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [KEY, JSON.stringify(SEED)])
  await page.goto(base + '/apps/habits.html')
  assert.equal(await todayDot(page), '2026-11-15', 'precondition: the 15th is highlighted before midnight')
  return { ctx, page }
}
const todayDot = page => page.$eval('.dots-row .dot.today', d => d.title)
const logs = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)).logs.h1, KEY)

test('a page left open past midnight moves the "today" highlight to the new day', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page } = await openBeforeMidnight()
  try {
    // 00:03 on the 16th; nothing else happens on the page meanwhile.
    await page.clock.fastForward('05:00')
    assert.equal(await todayDot(page), '2026-11-16', 'REGRESSION: the 15th is still highlighted as today after midnight')
  } finally { await ctx.close() }
})

test('tapping a dot drawn before midnight does not toggle yesterday', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page } = await openBeforeMidnight()
  try {
    // Move the date without firing any timers, so the view is still the stale
    // pre-midnight one when the user taps the dot highlighted as "today".
    await page.clock.setSystemTime(new Date('2026-11-16T00:03:00Z'))
    await page.click('.dots-row .dot.today')
    assert.deepEqual(await logs(page), SEED.logs.h1, 'REGRESSION: a stale tap changed yesterday\'s log')
    assert.equal(await todayDot(page), '2026-11-16', 'the stale tap should redraw the view for the new day')
  } finally { await ctx.close() }
})
