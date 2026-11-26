// Adi, 2026-11-26: the "My submissions" / "My notes" pills sat right on the divider above them.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

test('question-body sections share one spaced divider style', () => {
  assert.match(HTML, /\.q-section \{ margin-top: 1\.1rem; padding-top: 0\.9rem; border-top: 1px solid var\(--border\); \}/)
  assert.match(HTML, /const subsRow    = '<div class="q-section" id="subs-'/)
  assert.match(HTML, /const noteRow    = '<div class="q-section"><p class="mb-2">/)
  assert.ok(!/mt-3 pt-2" style="border-top/.test(HTML))
})
