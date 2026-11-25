'use strict'
// The notebook on a phone. At 390px the sidebar used to sit in the flex row and squeeze the
// page into a sliver; it is now a drawer over the page that starts closed and closes after
// you pick a destination. Desktop keeps the old behaviour and its saved preference.
// Skipped (not failed) when Playwright isn't installed. External requests are aborted, so
// Bootstrap's CSS is absent: the tests check the drawer's own rules, not Bootstrap layout.
//
// Run with: node --test test/notebook-phone-layout.test.js

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


async function open(width, seed = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 800 } })
  await ctx.route(url => !url.href.startsWith(base), r => r.abort())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, seed)
  await page.goto(base + '/index.html')
  await page.waitForFunction(() => document.querySelector('#sidebar .nav-link'))
  const state = () => page.evaluate(() => {
    const sb = document.getElementById('sidebar')
    return { collapsed: sb.classList.contains('collapsed'), position: getComputedStyle(sb).position,
             backdrop: getComputedStyle(document.getElementById('sidebar-backdrop')).display }
  })
  return { ctx, page, state, errors }
}

test('on a phone the sidebar starts closed and opens over the page, not beside it', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, state, errors } = await open(390, { 'dsa-sidebar-collapsed': '0' })
  assert.deepEqual(await state(), { collapsed: true, position: 'fixed', backdrop: 'none' })
  await page.click('.header-menu-btn[aria-label="Toggle sidebar"]')
  assert.deepEqual(await state(), { collapsed: false, position: 'fixed', backdrop: 'block' })
  await page.click('#sidebar button.nav-link:visible >> nth=1')   // pick a topic
  assert.equal((await state()).collapsed, true, 'picking a destination closes the drawer')
  await page.click('.header-menu-btn[aria-label="Toggle sidebar"]')
  await page.click('#sidebar-backdrop', { position: { x: 370, y: 400 } })
  assert.equal((await state()).collapsed, true, 'tapping outside closes the drawer')
  assert.equal(await page.evaluate(() => localStorage.getItem('dsa-sidebar-collapsed')), '0', 'the phone drawer does not change the saved preference')
  assert.deepEqual(errors, [])
  await ctx.close()
})

test('on a desktop the sidebar stays in the row and keeps its saved open/closed state', async (t) => {
  if (skipReason) return t.skip(skipReason)
  let { ctx, page, state } = await open(1280)
  assert.deepEqual(await state(), { collapsed: false, position: 'sticky', backdrop: 'none' })
  await page.click('#sidebar button.nav-link:visible >> nth=1')
  assert.equal((await state()).collapsed, false, 'picking a topic leaves it open')
  await ctx.close()
  ;({ ctx, state } = await open(1280, { 'dsa-sidebar-collapsed': '1' }))
  assert.equal((await state()).collapsed, true)
  await ctx.close()
})
