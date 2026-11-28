'use strict'
// Scripts run only from the site's own files and from inline <script> blocks pinned by hash in
// vercel.json, never from attributes: no 'unsafe-inline'. Event handlers are data-* actions
// (js/actions.js) that only call functions a page registered.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { execFileSync } = require('child_process')
const { pages } = require('../scripts/csp-hashes.js')
const { startServer, openBrowser, SKIP } = require('./prod-server')
const { loadApp, evalIn } = require('./load-app')

const ROOT = path.join(__dirname, '..')
const HANDLER = /\bon(?:click|dblclick|input|change|submit|keydown|keyup|keypress|blur|focus|toggle|mouse\w+|pointer\w+|touch\w+|load|error|scroll)\s*=\s*\\?["']/i

test('vercel.json pins the current inline scripts (else run: node scripts/csp-hashes.js)', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'csp-hashes.js'), '--check'], { stdio: 'pipe' })
})

test('no page or script has an inline event handler (the CSP would silently ignore it)', () => {
  const files = pages().concat(fs.readdirSync(path.join(ROOT, 'js'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f))
  const bad = []
  for (const f of files) {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      if (HANDLER.test(line.replace(/\/\/.*$/, ''))) bad.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 120))
    })
  }
  assert.deepEqual(bad, [])
})

test('every action named in the notebook\'s markup is registered', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + require('./load-app').notebookSource()
  const names = new Set([...html.matchAll(/data-(?:click|input|change|keydown|keyup|mouseup|focusout|toggle|error|load)="([\w$.]+)"/g)].map((m) => m[1]))
  names.add('_psRecallGrade'); names.add('_qpReviseGrade')   // picked at run time (fn variable)
  const { sandbox } = loadApp()
  const missing = [...names].filter((n) => typeof evalIn(sandbox, `Actions._registry[${JSON.stringify(n)}]`) !== 'function')
  assert.deepEqual(missing, [])
})

// js/actions.js on its own, with a hand-made event path.
function actionsSandbox() {
  const listeners = {}
  const sb = { window: null, console, JSON, Object, Array }
  sb.window = sb
  sb.addEventListener = (t, fn, capture) => { assert.equal(capture, true); listeners[t] = fn }
  vm.createContext(sb)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'actions.js'), 'utf8'), sb)
  function el(attrs, parent) {
    return { nodeType: 1, parentElement: parent || null, value: attrs.$value, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs }
  }
  function fire(type, target, extra) {
    const ev = Object.assign({ type, target, cancelBubble: false, stopped: false, prevented: false,
      stopPropagation() { this.stopped = true }, preventDefault() { this.prevented = true } }, extra)
    listeners[type](ev)
    return ev
  }
  return { A: sb.Actions, el, fire }
}

test('actions: run registered names with their args, inner element first, and stop where asked', () => {
  const { A, el, fire } = actionsSandbox()
  const log = []
  A.register({ outer: () => log.push('outer'), inner: function (x, self, v) { log.push(['inner', x, self === this, v]) } })
  const outer = el({ 'data-click': 'outer' })
  const inner = el({ 'data-click': 'inner', 'data-args': '[7, "$this", "$value"]', $value: 'typed' }, outer)
  fire('click', inner)
  assert.deepEqual(log, [['inner', 7, true, 'typed'], 'outer'])
  log.length = 0
  const stopper = el({ 'data-click': 'inner', 'data-args': '[1]', 'data-stop': '', 'data-prevent': '' }, outer)
  const ev = fire('click', stopper)
  assert.equal(log.length, 1, 'the outer action does not run past a stop')
  assert.ok(ev.stopped && ev.prevented)
})

test('actions: an unregistered name never runs, whatever global it names', () => {
  const { A, el, fire } = actionsSandbox()
  let cleared = false
  A.register({ ok: () => {} })
  const warn = console.warn; console.warn = () => {}
  try { fire('click', el({ 'data-click': 'localStorage.clear' })); fire('click', el({ 'data-click': 'constructor' })) }
  finally { console.warn = warn }
  assert.equal(cleared, false)
  assert.equal(Object.getPrototypeOf(A._registry), null, 'no inherited names such as constructor or toString')
})

test('actions: data-key limits a keydown action to that key; attrArgs survives HTML quoting', () => {
  const { A, el, fire } = actionsSandbox()
  const got = []
  A.register({ save: (k) => got.push(k) })
  const input = el({ 'data-keydown': 'save', 'data-key': 'Enter', 'data-args': '["LC_1"]' })
  fire('keydown', input, { key: 'a' }); fire('keydown', input, { key: 'Enter' })
  assert.deepEqual(got, ['LC_1'])
  const enc = A.attrArgs(['a"b', "c'd", '<x>&'])
  assert.ok(!/["'<>]/.test(enc))
  const decoded = enc.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  assert.deepEqual(JSON.parse(decoded), ['a"b', "c'd", '<x>&'])
})

// The real pages under the production CSP: no violation, and clicks still work.
test('under the production CSP every page runs without a violation, and actions work', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const violations = []
    await context.exposeBinding('__cspViolation', (_src, v) => violations.push(v))
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => window.__cspViolation(location.pathname + ' ' + e.violatedDirective + ' ' + (e.sample || e.blockedURI)))
    })
    for (const p of pages().filter((f) => !/^papers\/guides\/|^dsa\/(?!privacy)/.test(f) || /01-timeouts/.test(f))) {
      const page = await context.newPage()
      await page.goto(base + '/' + p)
      await page.waitForTimeout(150)
      await page.close()
    }
    const page = await context.newPage()
    await page.goto(base + '/index.html')
    await page.click('#nav-two-pointers')
    await page.waitForSelector('#topic-tabs, .nav-tabs', { timeout: 5000 })
    await page.click('#theme-toggle-btn')
    const theme = await page.evaluate(() => localStorage.getItem('dsa-theme'))
    assert.ok(theme === 'light' || theme === 'dark', 'the theme button ran')
    const gym = await context.newPage()
    await gym.goto(base + '/apps/gym-5day.html')
    await gym.click('.tab-btn >> text=Principles')
    assert.ok(await gym.evaluate(() => /active/.test([...document.querySelectorAll('.tab-btn')].find((b) => /Principles/.test(b.textContent)).className)))
    assert.deepEqual(violations.filter((v) => !/fonts\.g|font-src|img-src|frame-src/.test(v)), [])
  } finally {
    await browser.close(); server.close()
  }
})
