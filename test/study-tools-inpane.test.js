'use strict'
// Prep hub step 1 (Adi, 2026-11-25): DSA Thoughts, JS Built-ins and Study Sites open inside the
// hub like Paper Club and Visuals, instead of leaving it as their own pages. The DSA Master Map
// link is gone (Adi: "not used at all"). Habits and the 5-Day Split are the "Life" apps.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

for (const [key, src, title] of [
  ['thoughts', 'dsa/dsa-thoughts.html', 'DSA Thoughts'],
  ['jsbuiltins', 'dsa/js-builtins.html', 'JS Built-ins'],
  ['sites', 'dsa/study-sites.html', 'Study Sites'],
]) {
  test(title + ' opens in-pane, and a reload returns to it', () => {
    const { sandbox, getElement } = loadAppWithDom()
    evalIn(sandbox, `loadEmbed('${key}')`)
    assert.equal(getElement('page-frame').getAttribute('src'), src)
    assert.match(getElement('page-title').textContent, new RegExp(title))
    assert.equal(evalIn(sandbox, "localStorage.getItem('dsa-current-view-v1')"), key)
    const again = loadAppWithDom({ 'dsa-current-view-v1': key })
    assert.equal(again.getElement('page-frame').getAttribute('src'), src)
  })
  test('the sidebar opens ' + title + ' in-pane, not as a separate page', () => {
    assert.match(HTML, new RegExp(`id="nav-${key}"[^>]*data-click="loadEmbed" data-args='\\["${key}"\\]'`))
    assert.doesNotMatch(HTML, new RegExp(`<a href="${src}"`))
  })
}

test('the DSA Master Map is no longer in the sidebar', () => {
  assert.doesNotMatch(HTML, /href="dsa\/dsa-master-map\.html"/)
})

test('the in-pane pages hide their own theme button and follow the hub theme live', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'notes-theme.js'), 'utf8')
  assert.match(src, /window\.top !== window\.self/)
  assert.match(src, /addEventListener\('storage'/)
})
