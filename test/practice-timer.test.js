'use strict'
// The ⏱ countdown on the topic Practice Session (ps) and the dashboard Quick Practice (qp),
// driven through the real page with a fake clock. Written before the two timer copies were
// merged into one, so the merge has to reproduce every step here exactly.
// Skipped (not failed) when Playwright isn't installed.
//
// Run with: node --test test/practice-timer.test.js

const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const path = require('path')

const ROOT = path.join(__dirname, '..')

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

async function open() {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })
  await ctx.route(url => !url.href.startsWith(base), r => r.abort())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.clock.install({ time: new Date('2026-11-28T10:00:00') })
  await page.goto(base + '/index.html')
  await page.waitForFunction(() => document.querySelector('#sidebar .nav-link'))
  return { ctx, page, errors }
}

// One timer bar, found by its display id, so the test doesn't depend on handler names.
function bar(page, id, locks) {
  const sel = `.ps-timer-bar:has(#${id}-timer-disp)`
  return {
    preset: i => page.locator(`${sel} .ps-preset-btn`).nth(i).click(),
    play: () => page.locator(`#${id}-timer-play`).click(),
    reset: () => page.locator(`${sel} .ps-timer-ctrl[title="Reset timer"]`).click(),
    state: () => page.evaluate(([sel, id, locks]) => ({
      disp: document.getElementById(id + '-timer-disp').textContent,
      cls: document.getElementById(id + '-timer-disp').className,
      play: document.getElementById(id + '-timer-play').textContent,
      active: [...document.querySelectorAll(sel + ' .ps-preset-btn')].map(b => b.classList.contains('ps-active') ? 1 : 0).join(''),
      locked: locks.filter(l => document.getElementById(l)).map(l => document.getElementById(l).disabled ? 1 : 0).join('')
    }), [sel, id, locks])
  }
}

// Every step of a timer's life, the same for both panels: off, set, run, pause, reset, run out, restart.
async function walk(page, t, firstMins) {
  const s = []
  s.push(await t.state())
  await t.play(); s.push(await t.state())                          // nothing set: play does nothing
  await t.preset(1); s.push(await t.state())
  await t.play(); s.push(await t.state())
  await page.clock.runFor(3000); s.push(await t.state())
  await t.play(); s.push(await t.state())                          // pause
  await page.clock.runFor(3000); s.push(await t.state())           // paused: no change
  await t.reset(); s.push(await t.state())
  await t.preset(0); await t.play()
  await page.clock.runFor(firstMins * 60000 + 2000); s.push(await t.state())   // ran out
  await t.play(); s.push(await t.state())                          // restarts from the preset
  await page.clock.runFor(1000); s.push(await t.state())
  return s
}

const expected = (first, second, firstMins, nLocks) => {
  const all = n => String(n).repeat(nLocks), mm = m => String(m).padStart(2, '0') + ':00'
  const on = i => [0, 1, 2, 3].map(j => j === i ? 1 : 0).join('')
  return [
    { disp: 'Off', cls: 'ps-timer-display', play: '▶', active: '0000', locked: all(0) },
    { disp: 'Off', cls: 'ps-timer-display', play: '▶', active: '0000', locked: all(0) },
    { disp: mm(second), cls: 'ps-timer-display', play: '▶', active: on(1), locked: all(0) },
    { disp: mm(second), cls: 'ps-timer-display', play: '⏸', active: on(1), locked: all(1) },
    { disp: mm(second - 1).replace(':00', ':57'), cls: 'ps-timer-display ps-running', play: '⏸', active: on(1), locked: all(1) },
    { disp: mm(second - 1).replace(':00', ':57'), cls: 'ps-timer-display ps-running', play: '▶', active: on(1), locked: all(0) },
    { disp: mm(second - 1).replace(':00', ':57'), cls: 'ps-timer-display ps-running', play: '▶', active: on(1), locked: all(0) },
    { disp: mm(second), cls: 'ps-timer-display', play: '▶', active: on(1), locked: all(0) },
    { disp: '00:00', cls: 'ps-timer-display ps-expired', play: '▶', active: on(0), locked: all(0) },
    // Today the display only catches up on the next tick, so it still reads 00:00 for that second.
    { disp: '00:00', cls: 'ps-timer-display ps-expired', play: '⏸', active: on(0), locked: all(1) },
    { disp: mm(first - 1).replace(':00', ':59'), cls: 'ps-timer-display ps-running', play: '⏸', active: on(0), locked: all(1) }
  ]
}

test('dashboard Quick Practice timer: set, run, pause, reset, run out, restart', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, errors } = await open()
  const steps = await walk(page, bar(page, 'qp', ['qp-btn-dec', 'qp-btn-inc']), 5)
  assert.deepEqual(steps, expected(5, 10, 5, 2))
  assert.deepEqual(errors, [])
  await ctx.close()
})

test('topic Practice Session timer: set, run, pause, reset, run out, restart', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, errors } = await open()
  await page.locator('[data-click="loadTopic"]').first().click()
  await page.waitForSelector('#ps-timer-disp')
  // The topic panel's −/+/All have no ids to disable: _psAdjCount and _psSetAll refuse while it runs.
  const steps = await walk(page, bar(page, 'ps', []), 1)
  assert.deepEqual(steps, expected(1, 5, 1, 0))
  assert.deepEqual(errors, [])
  await ctx.close()
})
