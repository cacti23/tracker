'use strict'
// Adi, 2026-11-25: the hub has two notebooks, DSA and System Design, with a switch at the top
// of the sidebar. System Design opens in-pane; the sidebar then shows only what belongs to it.
// The mode is one named value ('dsa' | 'sd'), kept per device in 'dsa-hub-mode' (not synced).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const ROOT = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + require('./load-app').notebookSource()
const mode = (sb) => evalIn(sb, 'document.body.dataset.hubMode')

test('the System Design switch opens the notes in-pane, and a reload stays there', () => {
  const { sandbox, getElement } = loadAppWithDom()
  assert.equal(mode(sandbox), 'dsa')
  evalIn(sandbox, "switchHub('sd')")
  assert.equal(mode(sandbox), 'sd')
  assert.equal(getElement('sysdesign-frame').getAttribute('src'), 'sysdesign/system-design.html')
  assert.equal(evalIn(sandbox, "localStorage.getItem('dsa-hub-mode')"), 'sd')
  const again = loadAppWithDom({ 'dsa-current-view-v1': 'sysdesign', 'dsa-hub-mode': 'sd' })
  assert.equal(mode(again.sandbox), 'sd')
  assert.equal(again.getElement('sysdesign-frame').getAttribute('src'), 'sysdesign/system-design.html')
})

test('the DSA switch goes back to the dashboard', () => {
  const { sandbox } = loadAppWithDom({ 'dsa-current-view-v1': 'sysdesign', 'dsa-hub-mode': 'sd' })
  evalIn(sandbox, "switchHub('dsa')")
  assert.equal(mode(sandbox), 'dsa')
  assert.equal(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'dashboard')
})

test('a DSA page opened from System Design (search, a link) switches the sidebar back; shared pages keep the mode', () => {
  const { sandbox } = loadAppWithDom()
  evalIn(sandbox, "loadEmbed('papers')")
  assert.equal(mode(sandbox), 'sd', 'Paper Club belongs to System Design')
  evalIn(sandbox, "loadEmbed('sites')")
  assert.equal(mode(sandbox), 'sd', 'Study Sites belongs to both notebooks')
  evalIn(sandbox, "loadTopic('two-pointers')")
  assert.equal(mode(sandbox), 'dsa')
})

// Adi, 2026-11-25: switching felt slow. The page is ~1 MB; sharing a frame with Study Sites meant
// every Study Sites ↔ notes hop reloaded it. Its own frame loads it once per visit to the hub.
test('System Design keeps its own frame, so a hop to Study Sites and back does not reload it', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "switchHub('sd')")
  evalIn(sandbox, "loadEmbed('sites')")
  assert.equal(getElement('page-frame').getAttribute('src'), 'dsa/study-sites.html#sd')
  assert.equal(getElement('sysdesign-frame').getAttribute('src'), 'sysdesign/system-design.html')
  assert.match(HTML, /<div id="view-sysdesign" class="d-none">\s*<iframe id="sysdesign-frame"/)
})

test('an unknown stored mode falls back to DSA', () => {
  const { sandbox } = loadAppWithDom({ 'dsa-hub-mode': 'nope' })
  assert.equal(mode(sandbox), 'dsa')
})

test('the top bar has the notebook tabs, DSA-only sections are tagged, and Apps is now Life', () => {
  assert.match(HTML, /<nav class="hub-tabs" id="hub-tabs" aria-label="Notebooks">/)
  assert.match(HTML, /data-click="switchHub" data-args='\["dsa"\]'/)
  assert.match(HTML, /data-click="switchHub" data-args='\["sd"\]'/)
  for (const id of ['nav-dashboard', 'nav-thoughts', 'nav-jsbuiltins', 'nav-visuals', 'nav-topics']) {
    assert.match(HTML, new RegExp(`id="${id}"[^>]*data-hub="dsa"`), id + ' should show only in DSA')
  }
  assert.match(HTML, /id="nav-sysdesign"[^>]*data-hub="sd"/)
  for (const id of ['nav-papers', 'nav-postmortems']) assert.match(HTML, new RegExp(`id="${id}"[^>]*data-hub="sd"`), id + ' is System Design only')
  assert.doesNotMatch(HTML, /id="nav-sites"[^>]*data-hub=/, 'Study Sites is shared')
  assert.match(HTML, /id="nav-google"[^>]*data-hub="exp"/, 'Google lives in Interview experiences')
  assert.doesNotMatch(HTML, /<a href="sysdesign\/system-design\.html"/, 'System Design is no longer an app link')
  assert.match(HTML, /<summary[^>]*>🌱 Life<\/summary>/)
})

test('the System Design page skips layout for off-screen cards (it shares the hub\'s thread)', () => {
  const sd = fs.readFileSync(path.join(ROOT, 'sysdesign', 'system-design.html'), 'utf8')
  assert.match(sd, /section\.card \{ content-visibility: auto;/)
  assert.match(sd, /@media print \{ section\.card \{ content-visibility: visible; \} \}/)
})

test('the System Design page follows the hub theme live when embedded', () => {
  const sd = fs.readFileSync(path.join(ROOT, 'sysdesign', 'system-design.html'), 'utf8')
  assert.match(sd, /addEventListener\('storage'[\s\S]{0,200}dsa-theme/)
})

test('the Interview experiences button opens Google, and a reload stays there', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "switchHub('exp')")
  assert.equal(mode(sandbox), 'exp')
  assert.equal(getElement('google-frame').getAttribute('src'), 'google/google-onsite-log.html')
  const again = loadAppWithDom({ 'dsa-hub-mode': 'exp', 'dsa-current-view-v1': 'google' })
  assert.equal(mode(again.sandbox), 'exp')
  evalIn(sandbox, "switchHub('dsa')")
  assert.equal(mode(sandbox), 'dsa')
})
