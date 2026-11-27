'use strict'
// Adi, 2026-11-25: a very simple "How to use" right before the topics (Two Pointers), saying what
// the tracker is, how revision works and how to use it day to day.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadAppWithDom, evalIn } = require('./load-app')

const ROOT = path.join(__dirname, '..')
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')

// Adi, 2026-11-27 (navigation redesign): the big sidebar card moved out of the way. New visitors
// get the guide from the welcome card on the dashboard; everyone else from the sidebar footer.
test('How to use is in the sidebar footer and on the welcome card', () => {
  const footer = HTML.slice(HTML.indexOf('<div class="sidebar-footer">')).slice(0, 1200)
  assert.match(footer, /id="nav-howto" data-click="loadEmbed" data-args='\["howto"\]'/)
  assert.match(HTML, /data-click="loadEmbed" data-args="' \+ Actions\.attrArgs\(\['howto'\]\) \+ '">📖 2-minute guide<\/button>/)
  assert.doesNotMatch(HTML, /nav-howto-card/)
})

test('How to use opens in-pane and keeps the DSA notebook', () => {
  const { sandbox, getElement } = loadAppWithDom()
  evalIn(sandbox, "switchHub('sd')")
  evalIn(sandbox, "loadEmbed('howto')")
  assert.equal(getElement('page-frame').getAttribute('src'), 'dsa/how-to-use.html')
  assert.equal(evalIn(sandbox, 'document.body.dataset.hubMode'), 'dsa')
})

test('the guide matches the revision ladder in js/data.js', () => {
  const page = fs.readFileSync(path.join(ROOT, 'dsa', 'how-to-use.html'), 'utf8')
  const data = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8')
  const ladder = data.match(/const REVISE_LADDER = \[([\d, ]+)\]/)[1].split(',').map((s) => s.trim())
  assert.ok(page.includes(ladder.slice(0, -1).join(', ') + ', then ' + ladder.at(-1) + ' days'), 'solid ladder text is out of date')
  assert.ok(page.includes('Comes back in ' + ladder[1] + ' days'), 'shaky interval text is out of date')
})
