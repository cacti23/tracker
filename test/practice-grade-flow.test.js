'use strict'
// Grading rows in the two practice lists — topic Practice Session (ps-list) and dashboard Quick
// Practice (qp-results) — in a real page: the graded row redraws in place, the closing banner
// appears once every row is graded (and only once), and − trims ungraded rows before graded ones.
// Written before the ps/qp grade + trim code was shared, to hold its behaviour.
// Skipped (not failed) when Playwright isn't installed.
//
// Run with: node --test test/practice-grade-flow.test.js

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
  await page.addInitScript(() => { let s = 7; Math.random = () => (s = s * 16807 % 2147483647) / 2147483647 })
  await page.goto(base + '/index.html')
  await page.waitForFunction(() => document.querySelector('#sidebar .nav-link'))
  return { ctx, page, errors }
}


const rows = (page, id) => page.evaluate(id => [...document.querySelectorAll('#' + id + ' .ps-q-row')].map(r => r.dataset.lcKey + (r.className.match(/ps-q-(solid|shaky|forgot)/) || [''])[0]), id)
const banners = (page, id) => page.evaluate(id => [...document.querySelectorAll('#' + id + ' .ps-session-done')].map(b => b.textContent), id)
const grade = (page, id, i, g) => page.locator('#' + id + ' .ps-q-row').nth(i).locator('.rev-' + g).click()

test('dashboard solve list: rows tint as graded, banner once all are graded, − drops ungraded rows first', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, errors } = await open()
  await page.evaluate(() => { _qpTopics = new Set(['trees']); _qpCount = 4; _qpRevised = false; _renderQuickPractice(); _qpGenerate() })
  const keys = (await rows(page, 'qp-results'))
  assert.equal(keys.length, 4)
  await grade(page, 'qp-results', 1, 'solid')
  await grade(page, 'qp-results', 3, 'shaky')
  assert.deepEqual(await rows(page, 'qp-results'), [keys[0], keys[1] + 'ps-q-solid', keys[2], keys[3] + 'ps-q-shaky'])
  assert.deepEqual(await banners(page, 'qp-results'), [])
  await page.locator('#qp-btn-dec').click()                        // 4 → 3: drops ungraded keys[2], keeps graded keys[3]
  await page.locator('#qp-btn-dec').click()                        // 3 → 2: drops ungraded keys[0]
  assert.deepEqual(await rows(page, 'qp-results'), [keys[1] + 'ps-q-solid', keys[3] + 'ps-q-shaky'])
  assert.deepEqual(await banners(page, 'qp-results'), ['✅ Session complete · 2 solved'], 'every row left is graded')
  await page.locator('#qp-btn-dec').click()                        // 2 → 1: now a graded row has to go
  assert.deepEqual(await rows(page, 'qp-results'), [keys[1] + 'ps-q-solid'])
  assert.deepEqual(errors, [])
  await ctx.close()
})

test('dashboard solve list: grading the last row shows the banner once', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, errors } = await open()
  await page.evaluate(() => { _qpTopics = new Set(['heap']); _qpCount = 2; _qpRevised = false; _renderQuickPractice(); _qpGenerate() })
  await grade(page, 'qp-results', 0, 'forgot')
  assert.deepEqual(await banners(page, 'qp-results'), [])
  await grade(page, 'qp-results', 1, 'solid')
  assert.deepEqual(await banners(page, 'qp-results'), ['✅ Session complete · 2 graded'])
  await grade(page, 'qp-results', 1, 'shaky')                      // regrade: still one banner
  assert.deepEqual(await banners(page, 'qp-results'), ['✅ Session complete · 2 graded'])
  assert.deepEqual(errors, [])
  await ctx.close()
})

test('dashboard Graded and topic Graded: recall sweep banner once every row is graded', async (t) => {
  if (skipReason) return t.skip(skipReason)
  const { ctx, page, errors } = await open()
  // Graded lists draw from questions you have graded, so grade three trees questions first.
  await page.evaluate(() => Object.keys(TOPIC_MODULES.trees.questions).slice(0, 3).forEach(k => gradeRevise(k, 'forgot')))
  await page.evaluate(() => { _qpTopics = new Set(['trees']); _qpCount = 3; _qpRevised = true; _renderQuickPractice(); _qpGenerate() })
  const n = (await rows(page, 'qp-results')).length
  assert.ok(n >= 1)
  for (let i = 0; i < n; i++) await grade(page, 'qp-results', i, 'solid')
  assert.deepEqual(await banners(page, 'qp-results'), ['🧠 Recall sweep complete · ' + n + ' graded'])
  assert.ok((await rows(page, 'qp-results')).every(r => r.endsWith('ps-q-solid')))

  // The rows just graded ✓ are now resting, so the topic list needs freshly forgotten ones.
  await page.evaluate(() => Object.keys(TOPIC_MODULES.heap.questions).slice(0, 3).forEach(k => gradeRevise(k, 'forgot')))
  await page.evaluate(() => loadTopic('heap'))
  await page.evaluate(() => { _psQCount = 3; _psGenerateGraded('heap') })
  const m = (await rows(page, 'ps-list')).length
  assert.ok(m >= 1)
  for (let i = 0; i < m; i++) await grade(page, 'ps-list', i, 'shaky')
  assert.deepEqual(await banners(page, 'ps-list'), ['🧠 Recall sweep complete · ' + m + ' graded'])
  assert.ok((await rows(page, 'ps-list')).every(r => r.endsWith('ps-q-shaky')))
  assert.deepEqual(errors, [])
  await ctx.close()
})
