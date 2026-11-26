// Sidebar sections follow the notebook switch: a DSA group shows only DSA pages,
// Resources serve both notebooks, and Privacy (about the app, not study) sits in the footer.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const nav = HTML.slice(HTML.indexOf('<nav class="flex-grow-1'), HTML.indexOf('</nav>'))

// Map each nav button id to the section label above it.
function sections() {
  const out = {}
  let label = '(top)'
  const re = /<p class="sidebar-section-label"[^>]*>([^<]+)<\/p>|<button type="button" id="(nav-[a-z]+)"([^>]*)>/g
  let m
  while ((m = re.exec(nav))) {
    if (m[1]) label = m[1]
    else out[m[2]] = { label, dsaOnly: /data-hub="dsa"/.test(m[3]) }
  }
  return out
}

test('How to use says it is for DSA and sits right under the Dashboard', () => {
  assert.match(HTML, /<span class="nav-topic-label">How to use \(DSA\)<\/span>/)
  const ids = Object.keys(sections())
  assert.strictEqual(ids[ids.indexOf('nav-dashboard') + 1], 'nav-sysdesign')
  assert.strictEqual(ids[ids.indexOf('nav-sysdesign') + 1], 'nav-howto')
  assert.strictEqual(sections()['nav-howto'].label, '(top)')
})

test('the DSA study tools group holds only DSA pages', () => {
  const s = sections()
  for (const id of ['nav-thoughts', 'nav-jsbuiltins', 'nav-visuals']) {
    assert.strictEqual(s[id].label, 'DSA study tools', id)
    assert.ok(s[id].dsaOnly, id + ' should be DSA only')
  }
  assert.match(nav, /<p class="sidebar-section-label" data-hub="dsa">DSA study tools<\/p>/)
})

test('Resources serve both notebooks', () => {
  const s = sections()
  for (const id of ['nav-sites', 'nav-papers', 'nav-postmortems']) {
    assert.strictEqual(s[id].label, 'Resources', id)
    assert.ok(!s[id].dsaOnly, id + ' should show in both notebooks')
  }
  assert.match(nav, /<p class="sidebar-section-label">Resources<\/p>/)
})

test('Privacy is in the sidebar footer, not in a study section', () => {
  assert.ok(!nav.includes('id="nav-privacy"'))
  const footer = HTML.slice(HTML.indexOf('<div class="sidebar-footer">'))
  assert.match(footer.slice(0, 600), /id="nav-privacy"[^>]*onclick="loadEmbed\('privacy'\)"/)
})
