'use strict'
// Adi, 2026-11-26: Study Sites stays in both notebooks, but each shows only its own sites
// (DSA: VisuAlgo and friends; System Design: the SD, networking and database sites).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { loadAppWithDom, evalIn } = require('./load-app')

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'dsa', 'study-sites.html'), 'utf8')
const SCRIPT = PAGE.match(/<script>([\s\S]*?)<\/script>/)[1]

// Runs the page's script on a tiny fake DOM and returns the names of the tiles it shows.
function page(hash) {
  const lists = {}
  const listeners = {}
  const node = (id) => {
    const n = { id, children: [], classList: { add() {}, remove() {} }, setAttribute() {}, remove() {},
      append(...c) { this.children.push(...c) }, replaceChildren(...c) { this.children = c } }
    if (id) lists[id] = n
    return n
  }
  const location = { hash }
  const sandbox = {
    document: { getElementById: node, createElement: () => node() },
    window: { addEventListener: (e, f) => { listeners[e] = f } },
    location, URL, encodeURIComponent, setTimeout,
  }
  sandbox.window.top = sandbox.window.self = sandbox.window
  vm.createContext(sandbox)
  vm.runInContext(SCRIPT, sandbox)
  const names = () => JSON.parse(vm.runInContext('JSON.stringify(shown.map(s => s.name))', sandbox))
  const cats = () => JSON.parse(vm.runInContext('JSON.stringify(cats)', sandbox))
  const go = (h) => { location.hash = h; listeners.hashchange() }
  return { names, cats, go, tiles: () => lists.list.children.length }
}

test('DSA shows the DSA sites (and Behavioral), not the system design ones', () => {
  const p = page('#dsa')
  assert.ok(p.names().includes('VisuAlgo'))
  assert.ok(!p.names().includes('BreakStack'))
  assert.deepStrictEqual(p.cats(), ['Behavioral', 'DSA'])
})

test('System Design shows its sites, not the DSA ones', () => {
  const p = page('#sd')
  assert.ok(p.names().includes('BreakStack'))
  assert.ok(!p.names().includes('VisuAlgo'))
  assert.ok(!p.cats().includes('DSA'))
})

test('switching notebook with the frame still open re-filters the list', () => {
  const p = page('#sd')
  p.go('#dsa')
  assert.ok(p.names().includes('VisuAlgo'))
  assert.strictEqual(p.tiles(), p.names().length)
})

test('opened on its own (no hash) the page lists every site', () => {
  assert.ok(page('').names().length >= 14)
})

test('the hub opens Study Sites for the notebook it is in', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "loadEmbed('sites')")
  assert.equal(getElement('page-frame').getAttribute('src'), 'dsa/study-sites.html#dsa')
  evalIn(sandbox, "loadEmbed('papers')")
  evalIn(sandbox, "loadEmbed('sites')")
  assert.equal(getElement('page-frame').getAttribute('src'), 'dsa/study-sites.html#sd')
})
