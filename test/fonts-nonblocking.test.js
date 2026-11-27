'use strict'
// Adi, 2026-11-26: "How to use the DSA tracker" took a long time to open the first time. Its
// stylesheet @imported Google Fonts, and a page can't paint until every stylesheet in its <head>
// (imports included) has arrived: ~1.5 s of blank pane on a slow first visit. Fonts now load
// without blocking (the text shows in the fallback font, then switches).
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'vendor', 'test'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files(p, out); else if (/\.(html|css)$/.test(e.name)) out.push(p)
  }
  return out
}

test('no stylesheet @imports Google Fonts (an @import always blocks the first paint)', () => {
  const bad = files(ROOT).filter(f => f.endsWith('.css') && /@import\s+url\(["']?https:\/\/fonts\.googleapis/.test(fs.readFileSync(f, 'utf8')))
  assert.deepStrictEqual(bad.map(f => path.relative(ROOT, f)), [])
})

// The switch is js/font-swap.js, not onload="": the CSP refuses inline handlers.
test('every Google Fonts <link> loads as media="print" and font-swap.js switches it on load', () => {
  const bad = []
  for (const f of files(ROOT).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8')
    for (const tag of html.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g) || []) {
      if (!/media="print"/.test(tag) || !/data-font-swap/.test(tag)) bad.push(path.relative(ROOT, f))
    }
    if ((html.match(/data-font-swap/g) || []).length && !/<script src="(\.\.\/)?js\/font-swap\.js"><\/script>/.test(html)) bad.push(path.relative(ROOT, f) + ' (no font-swap.js)')
  }
  assert.deepStrictEqual(bad, [])
})

test('the study pages get the hub font from notes-theme.js, without blocking', () => {
  const js = fs.readFileSync(path.join(ROOT, 'js', 'notes-theme.js'), 'utf8')
  assert.match(js, /font\.media = 'print'/)
  assert.match(js, /font\.onload = function \(\) \{ font\.media = 'all' \}/)
})
