// Sidebar sections follow the notebook switch: a DSA group shows only DSA pages,
// Study Sites serves both notebooks, and Privacy (about the app, not study) sits in the footer.
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
    else out[m[2]] = { label, hub: (/data-hub="(\w+)"/.exec(m[3]) || [])[1] || null }
  }
  return out
}

test('How to use the DSA tracker is a card above the Dashboard', () => {
  assert.match(HTML, /class="nav-link nav-howto-card"/)
  assert.match(HTML, /<b>How to use the DSA tracker<\/b>/)
  const ids = Object.keys(sections())
  assert.strictEqual(ids[0], 'nav-howto')
  assert.strictEqual(ids[1], 'nav-dashboard')
  assert.ok(sections()['nav-howto'].hub === 'dsa')
})

test('one Study tools heading: DSA items, System Design items, and Study Sites in both', () => {
  const s = sections()
  assert.match(nav, /<p class="sidebar-section-label">Study tools<\/p>/)
  for (const id of ['nav-thoughts', 'nav-jsbuiltins', 'nav-visuals']) assert.deepStrictEqual([s[id].label, s[id].hub], ['Study tools', 'dsa'], id)
  for (const id of ['nav-papers', 'nav-postmortems']) assert.deepStrictEqual([s[id].label, s[id].hub], ['Study tools', 'sd'], id)
  assert.deepStrictEqual([s['nav-sites'].label, s['nav-sites'].hub], ['Study tools', null])
  assert.match(nav, /<span class="nav-topic-label">DSA Visuals<\/span>/)
  assert.ok(!/>Resources</.test(nav), 'no separate Resources heading')
})

test('Interview experiences comes after Study tools, in the DSA notebook only', () => {
  assert.strictEqual(sections()['nav-google'].label, 'Interview experiences')
  assert.ok(nav.indexOf('>Interview experiences<') > nav.indexOf('>Study tools<'))
})

test('opening Paper Club or Postmortems switches to the System Design notebook', () => {
  assert.match(HTML, /for \(const k of \['papers', 'postmortems'\]\) EMBEDS\[k\]\.hub = 'sd'/)
})

test('Privacy is in the sidebar footer with the "we collect nothing" line', () => {
  assert.ok(!nav.includes('id="nav-privacy"'))
  const footer = HTML.slice(HTML.indexOf('<div class="sidebar-footer">')).slice(0, 900)
  assert.match(footer, /id="nav-privacy"[^>]*data-click="loadEmbed" data-args='\["privacy"\]'/)
  assert.match(footer, /We collect nothing\. Your progress stays in your browser and your own GitHub\./)
})
