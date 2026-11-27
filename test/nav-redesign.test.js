'use strict'
// Adi, 2026-11-27: navigation redesign (both phases, one PR).
//   1. DSA · System Design · Interviews are tabs in the top bar; on phones a bottom tab bar.
//   2. Sign in sits top right.
//   3. One search box: problems in DSA, the notes and glossary in System Design.
//   4. System Design's lessons live in the hub sidebar (by topic or by course, with a filter),
//      so inside the hub the notes page hides its own tabs, chips, Index and Search pill.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')
const { startServer, openBrowser, SKIP } = require('./prod-server')

const ROOT = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const SD = fs.readFileSync(path.join(ROOT, 'sysdesign', 'system-design.html'), 'utf8')
const header = HTML.slice(HTML.indexOf('<header>'), HTML.indexOf('</header>'))
const sidebar = HTML.slice(HTML.indexOf('<aside id="sidebar"'), HTML.indexOf('</aside>'))

test('the notebook tabs and the account button are in the top bar, not the sidebar', () => {
  assert.match(header, /<nav class="hub-tabs" id="hub-tabs"/)
  for (const m of ['dsa', 'sd', 'exp']) assert.match(header, new RegExp(`data-mode="${m}"[^>]*data-click="switchHub" data-args='\\["${m}"\\]'`))
  assert.match(header, /id="dataAccountBtn"[^>]*data-click="DataSync\.account"/)
  assert.doesNotMatch(sidebar, /dataAccountBtn|hub-switch|hub-tabs/)
  assert.match(HTML, /@media \(max-width: 768px\) \{\s*\.hub-tabs \{\s*position: fixed; left: 0; right: 0; bottom: 0;/, 'bottom tab bar on phones')
})

test('switching notebook marks the current tab and retitles the search box', () => {
  const { sandbox, getElement } = loadAppWithDom()
  const tabs = ['dsa', 'sd', 'exp'].map(m => ({ dataset: { mode: m }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v }, removeAttribute(k) { delete this.attrs[k] } }))
  sandbox.__tabs = tabs
  evalIn(sandbox, "document.querySelectorAll = sel => sel === '.hub-tabs button' ? __tabs : []")
  evalIn(sandbox, "setHubMode('sd')")
  assert.deepEqual(tabs.map(t => t.attrs['aria-current'] || null), [null, 'page', null])
  assert.match(getElement('global-search-input').placeholder, /notes/)
  evalIn(sandbox, "setHubMode('dsa')")
  assert.deepEqual(tabs.map(t => t.attrs['aria-current'] || null), ['page', null, null])
  assert.match(getElement('global-search-input').placeholder, /problems/)
})

test('opening System Design (even via Paper Club) loads the notes, which the sidebar map comes from', () => {
  const { sandbox, getElement } = loadAppWithDom()
  assert.equal(getElement('sysdesign-frame').getAttribute('src'), null)
  evalIn(sandbox, "loadEmbed('papers')")
  assert.equal(getElement('sysdesign-frame').getAttribute('src'), 'sysdesign/system-design.html')
})

function withFakeNotes(view = 'topics') {
  const app = loadAppWithDom({ 'dsa-hub-mode': 'sd' })
  const calls = []
  app.sandbox.__nav = {
    view: () => view,
    tree: () => ({
      topics: [{ key: 'Caching', title: 'Caching', cards: [{ id: 'sd-a', title: 'Cache <aside>' }, { id: 'sd-b', title: 'Eviction' }] },
        { key: 'Sharding', title: 'Sharding', cards: [{ id: 'sd-c', title: 'Shard keys' }] }],
      lessons: [{ key: 'caching', title: '03 · Caching', cards: [{ id: 'sd-a', title: 'Cache <aside>' }] }],
    }),
    go: (...a) => calls.push(a),
  }
  app.sandbox.__searched = []
  evalIn(app.sandbox, "document.getElementById('sysdesign-frame').contentWindow = { SDNAV: __nav, SDNAV_search: q => __searched.push(q) }")
  return { ...app, calls }
}

test('the System Design map lists topics with counts, escapes titles, and opens one group at a time', () => {
  const { sandbox, getElement } = withFakeNotes()
  evalIn(sandbox, 'renderSdTree()')
  let html = getElement('nav-sd-tree').innerHTML
  assert.match(html, / Caching<\/span><span class="sd-count">2</)
  assert.match(html, /Cache &lt;aside&gt;/)
  assert.doesNotMatch(html, /Cache <aside>/)
  assert.match(html, /aria-pressed="true"[^>]*>By topic</)
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 0, 'all closed at first')
  evalIn(sandbox, "sdTreeToggle('Caching')")
  html = getElement('nav-sd-tree').innerHTML
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 1)
  evalIn(sandbox, "sdTreeToggle('Sharding')")
  html = getElement('nav-sd-tree').innerHTML
  assert.match(html, /aria-expanded="true" data-click="sdTreeToggle" data-args="\[&quot;Sharding&quot;\]"/)
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 1, 'opening one closes the other')
})

test('picking a lesson opens the notes at that card, in its topic', () => {
  const { sandbox, getElement, calls } = withFakeNotes()
  evalIn(sandbox, "sdOpenCard('topics', 'Sharding', 'sd-c')")
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['topics', 'Sharding', 'sd-c']])
  assert.equal(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'sysdesign')
  assert.match(getElement('nav-sd-tree').innerHTML, /class="nav-link sd-card active"[^>]*data-args="\[&quot;topics&quot;,&quot;Sharding&quot;,&quot;sd-c&quot;\]"/)
  evalIn(sandbox, "sdOpenCard('map')")
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), ['map'])
})

test('By course lists the course lessons', () => {
  const { sandbox, getElement } = withFakeNotes('courses')
  evalIn(sandbox, 'renderSdTree()')
  const html = getElement('nav-sd-tree').innerHTML
  assert.match(html, /03 · Caching/)
  assert.doesNotMatch(html, />Sharding</)
  assert.match(html, /aria-pressed="true"[^>]*>By course</)
})

test('in System Design the one search box searches the notes, not the problems', () => {
  const { sandbox, getElement } = withFakeNotes()
  evalIn(sandbox, "setHubMode('sd')")
  getElement('global-search-input').value = 'redis'
  evalIn(sandbox, 'handleGlobalSearch()')
  assert.deepEqual([...sandbox.__searched], ['redis'])
  assert.notEqual(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'search')
  getElement('global-search-input').value = ''
  evalIn(sandbox, 'handleGlobalSearch()')
  assert.deepEqual([...sandbox.__searched], ['redis', ''], 'an empty box closes the results')
})

test('the notes page exposes its map to the hub and hides its own inside the hub', () => {
  assert.match(SD, /window\.SDNAV = \{/)
  assert.match(SD, /window\.SDNAV_search = text =>/)
  assert.match(SD, /\.in-hub #views, \.in-hub #chips, \.in-hub #index, \.in-hub \.gl-fab \{ display: none !important; \}/)
  assert.match(SD, /window\.top !== window\.self && typeof window\.top\.renderSdTree === 'function'/)
})

test('in a browser: the sidebar lists the real lessons, opens one, and filters', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(base + '/index.html')
    await page.evaluate(() => switchHub('sd'))
    await page.waitForSelector('#nav-sd-tree .sd-group', { timeout: 15000 })
    const frame = page.frameLocator('#sysdesign-frame')
    assert.equal(await frame.locator('#views').isVisible(), false, 'the page hides its own tabs in the hub')
    const group = page.locator('#nav-sd-tree .sd-group').filter({ hasText: 'Caching' }).first()
    await group.click()
    const card = page.locator('#nav-sd-tree .sd-card:not([hidden])').first()
    const title = (await card.textContent()).trim()
    await card.click()
    const shown = await page.frame({ url: /system-design\.html/ }).evaluate(() =>
      [...document.querySelectorAll('#list > section.card')].filter(c => !c.hidden).map(c => c.dataset.topic))
    assert.ok(shown.length && shown.every(t => t === 'Caching'), 'only that topic shows')
    assert.ok(title.length > 0)
    await page.fill('#nav-sd-tree .sd-filter', 'zzzz-no-such-lesson')
    assert.equal(await page.locator('#nav-sd-tree .sd-g:not([hidden])').count(), 0)
    await page.fill('#nav-sd-tree .sd-filter', '')
    assert.ok(await page.locator('#nav-sd-tree .sd-g:not([hidden])').count() > 3)
  } finally {
    await browser.close()
    server.close()
  }
})
