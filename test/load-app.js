'use strict'
// Loads data.js + the inline app script from index.html into a Node vm context,
// with a real (in-memory) localStorage and just enough of `document`/`window`
// stubbed out that the script parses and runs without a real browser.
//
// This exists so grading/generation logic (which is pure JS reading/writing
// localStorage) can be unit-tested without spinning up a browser. It does NOT
// attempt to test rendering/DOM output — only the state logic: what gets
// written to localStorage, and what a given render function *decides* to show
// (via the HTML string it returns), as opposed to how a real browser paints it.
//
// IMPORTANT: most app state (`_qpResults`, `_qpMock`, `_psMode`, ...) is declared
// with `let`/`const` at the top level of index.html's inline script. Per JS
// semantics that does NOT attach them to the global object, so they are not
// reachable as `sandbox.someVar` — only top-level `function`s are. Use `evalIn`
// (a thin wrapper over vm.runInContext) to read/write that state from tests.

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')

function makeLocalStorage() {
  const store = new Map()
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null },
    setItem(k, v) { store.set(k, String(v)) },
    removeItem(k) { store.delete(k) },
    clear() { store.clear() },
    key(i) { return Array.from(store.keys())[i] ?? null },
    get length() { return store.size },
    _dump() { return Object.fromEntries(store) },
  }
}

function extractInlineScript(html) {
  // The app's real logic lives in the LAST <script>...</script> block (no src=),
  // which starts right after data.js/sync.js are loaded. Grab it specifically
  // rather than the first inline block (that one's just the pre-paint theme guard).
  const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(m => !/<script\s+src=/.test(m[0]))
  if (blocks.length === 0) throw new Error('No inline <script> block found in index.html')
  return blocks[blocks.length - 1][1].replace(/\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\//g, '')
}

function fakeElement() {
  const noop = () => {}
  return {
    style: {}, dataset: {}, classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, setAttribute: noop, getAttribute: () => null,
    insertAdjacentHTML: noop, click: noop,
    get outerHTML() { return '' }, set outerHTML(v) {},
    get innerHTML() { return '' }, set innerHTML(v) {},
    get textContent() { return '' }, set textContent(v) {},
  }
}

// Builds a fresh sandbox (fresh localStorage + fresh app state) for one test.
function loadApp() {
  const localStorage = makeLocalStorage()
  const noop = () => {}
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    createElement: () => fakeElement(),
    body: fakeElement(),
    documentElement: fakeElement(),
  }
  const window = { addEventListener: noop, removeEventListener: noop }
  const sandbox = {
    localStorage, document, window,
    console, Math, Date, JSON, Object, Array, String, Number, Boolean,
    Set, Map, Promise, RegExp, Error,
    fetch: () => Promise.reject(new Error('network disabled in tests')),
    alert: noop, confirm: () => true, prompt: () => null,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Blob: function Blob() {},
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
  }
  vm.createContext(sandbox)

  const dataJs = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8')
  vm.runInContext(dataJs, sandbox, { filename: 'data.js' })

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const appJs = extractInlineScript(indexHtml)
  vm.runInContext(appJs, sandbox, { filename: 'index.html (inline script)' })

  return { sandbox, localStorage }
}

// Evaluate a snippet of app-level JS (has access to every let/const/function
// declared in data.js + index.html's inline script) and return its value.
function evalIn(sandbox, code) {
  return vm.runInContext(code, sandbox)
}

// Any real [lcKey, questionObj] pair to use as test fixtures, plus its topic key.
function anyQuestion(sandbox, topicKey) {
  return evalIn(sandbox, `
    (function () {
      const tKey = ${topicKey ? JSON.stringify(topicKey) : 'Object.keys(TOPIC_MODULES)[0]'}
      const qKey = Object.keys(TOPIC_MODULES[tKey].questions)[0]
      return { topicKey: tKey, lcKey: qKey }
    })()
  `)
}

function nQuestions(sandbox, topicKey, n) {
  return evalIn(sandbox, `Object.keys(TOPIC_MODULES[${JSON.stringify(topicKey)}].questions).slice(0, ${n})`)
}

module.exports = { loadApp, makeLocalStorage, evalIn, anyQuestion, nQuestions }
