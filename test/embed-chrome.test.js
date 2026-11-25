'use strict'
// Adi, 2026-11-25:
//   1. A Study Sites tile opens the site inside the hub (not a new tab), and the sidebar closes;
//      the header names the site with a link to open it in its own tab.
//   2. The title/tag search is only for the DSA tracker: hide it on embedded pages.
//   3. On embedded pages the top bar tucks away while scrolling down and comes back on scroll up.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const ROOT = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')

test('openSite shows the site in-pane, names it in the header with an open-in-new-tab link', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "openSite({ name: 'Visu<Algo', url: 'https://visualgo.net/en', icon: '🎞️' })")
  assert.equal(getElement('site-frame').getAttribute('src'), 'https://visualgo.net/en')
  assert.match(getElement('page-title').textContent, /Visu<Algo/)
  const tabs = getElement('header-tabs').innerHTML
  assert.match(tabs, /href="https:\/\/visualgo\.net\/en" target="_blank" rel="noopener"/)
  assert.doesNotMatch(tabs, /Visu<Algo/, 'names go into the header escaped')
  assert.match(tabs, /onclick="loadEmbed\('sites'\)"/, 'a way back to the list')
})

test('openSite refuses anything but an http(s) URL', () => {
  const { sandbox } = loadAppWithDom()
  evalIn(sandbox, "openSite({ name: 'x', url: 'javascript:alert(1)' })")
  assert.notEqual(evalIn(sandbox, "document.getElementById('site-frame').getAttribute('src')"), 'javascript:alert(1)')
  assert.notEqual(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'site')
})

test('Study Sites hands tile clicks to the hub when embedded, and keeps new-tab links standalone', () => {
  const page = fs.readFileSync(path.join(ROOT, 'dsa', 'study-sites.html'), 'utf8')
  assert.match(page, /window\.top !== window\.self && typeof window\.top\.openSite === 'function'/)
  assert.match(page, /a\.target = '_blank'/)
})

test('the CSP lets the hub frame https sites, and the site frame is sandboxed', () => {
  const csp = JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')))
  assert.match(csp, /frame-src 'self' https:/)
  assert.match(HTML, /<iframe id="site-frame" class="embed-frame"[^>]*sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/)
})

test('search shows only on the DSA tracker pages', () => {
  assert.match(HTML, /body\.embed-view #global-search-input \{ display: none/)
})

test('embedded pages tuck the top bar away while scrolling down', () => {
  assert.match(HTML, /body\.embed-view\.header-tucked header \{/)
  assert.match(HTML, /function _watchEmbedScroll\(frame\)/)
})
