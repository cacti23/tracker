'use strict'
// Production Postmortems (Adi, 2026-11-25): a tracker of 20 real outages, built like Paper Club,
// shared by both notebooks, with its progress synced like Paper Club's.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const ROOT = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const PAGE = fs.readFileSync(path.join(ROOT, 'papers', 'postmortems.html'), 'utf8')

test('Postmortems opens in-pane, and a reload returns to it', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "loadEmbed('postmortems')")
  assert.equal(getElement('page-frame').getAttribute('src'), 'papers/postmortems.html')
  assert.match(getElement('page-title').textContent, /Postmortems/)
  assert.equal(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), 'postmortems')
  const again = loadAppWithDom({ 'dsa-current-view-v1': 'postmortems' })
  assert.equal(again.getElement('page-frame').getAttribute('src'), 'papers/postmortems.html')
})

test('the sidebar entry lives in the System Design notebook (Adi, 2026-11-26), and Paper Club keeps its name', () => {
  assert.match(HTML, /id="nav-postmortems" data-hub="sd" onclick="loadEmbed\('postmortems'\)"/)
  assert.match(HTML, /<span class="nav-topic-label">Paper Club<\/span>/)
})

test('postmortem progress syncs across devices', () => {
  const { sandbox } = loadAppWithDom()
  assert.ok(evalIn(sandbox, 'BACKUP_KEYS').includes('postmortems-v1'))
  assert.match(PAGE, /const KEY = "postmortems-v1"/)
})

test('the page lists all 20 incidents once, each with an https link', () => {
  const ns = [...PAGE.matchAll(/\{ n: (\d+), g: [1-4], /g)].map(m => +m[1]).sort((a, b) => a - b)
  assert.deepEqual(ns, Array.from({ length: 20 }, (_, i) => i + 1))
  const urls = [...PAGE.matchAll(/url: "([^"]+)"/g)].map(m => m[1])
  for (const u of urls) assert.match(u, /^https:\/\//, u)
})
