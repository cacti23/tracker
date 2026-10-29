'use strict'
// Guards the "← Tracker" back pill: every standalone page must load it (so you can never
// get stranded on dsa-thoughts / js-builtins / gym / habits / a cheatsheet again), and its
// own logic must behave. Run with: node --test test/back-button.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'back-button.js'), 'utf8')

function standalonePages() {
  const out = []
  for (const dir of ['dsa', 'apps', 'google', 'papers', 'visuals', 'sysdesign']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.html')) out.push(path.join(dir, f))
  }
  return out
}

test('every standalone page (dsa/, apps/, google/, papers/, visuals/, sysdesign/) loads ../js/back-button.js', () => {
  const missing = standalonePages().filter(f => !/<script src="\.\.\/js\/back-button\.js"><\/script>/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
  assert.deepEqual(missing, [], `pages with no back-to-tracker button: ${missing.join(', ')}`)
})

test('sidebar app links open in the same tab (a new tab/window has no way back in a PWA)', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  for (const href of ['apps/gym-5day.html', 'apps/habits.html', 'sysdesign/system-design.html', 'dsa/dsa-master-map.html', 'dsa/dsa-thoughts.html', 'dsa/js-builtins.html']) {
    const m = html.match(new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))
    assert.ok(m, `sidebar link to ${href} missing`)
    assert.doesNotMatch(m[0], /target="_blank"/, `${href} must not open in a new tab`)
  }
})

test('service workers precache the back-button script', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /js\/back-button\.js/)
  assert.match(fs.readFileSync(path.join(ROOT, 'apps', 'habits-sw.js'), 'utf8'), /\.\.\/js\/back-button\.js/)
})

function run({ top = true, referrer = '', historyLength = 3, pageUrl = 'https://t.example/dsa/dsa-thoughts.html' } = {}) {
  const appended = []
  const listeners = {}
  const win = {}
  win.top = top ? win : {}
  win.self = win
  const doc = {
    referrer,
    currentScript: { src: 'https://t.example/js/back-button.js' },
    head: { appendChild() {} },
    body: { appendChild(el) { appended.push(el) } },
    getElementById: () => null,
    createElement: () => ({ addEventListener(t, fn) { listeners[t] = fn }, setAttribute() {} }),
  }
  let backCalls = 0
  vm.runInNewContext(SRC, { window: win, document: doc, URL, location: { href: pageUrl }, history: { length: historyLength, back() { backCalls++ } } })
  const btn = appended[0]
  return { btn, click() { let prevented = false; listeners.click({ preventDefault() { prevented = true } }); return { prevented, backCalls } } }
}

test('adds a "← Tracker" link pointing at the root index.html', () => {
  const { btn } = run()
  assert.equal(btn.href, 'https://t.example/index.html')
  assert.match(btn.textContent, /Tracker/)
})

test('does nothing inside an iframe (the Google tabs embed these pages)', () => {
  assert.equal(run({ top: false }).btn, undefined)
})

test('the pill always navigates to the tracker and never hijacks the click with history.back()', () => {
  // history.back() would only undo in-page anchors/links on a long page; it must never be used.
  for (const referrer of ['https://t.example/', 'https://t.example/index.html', '', 'https://other.site/']) {
    const { btn, click } = run({ referrer })
    assert.equal(btn.href, 'https://t.example/index.html')
    assert.throws(() => click(), TypeError, 'no click handler should be attached')
  }
})
