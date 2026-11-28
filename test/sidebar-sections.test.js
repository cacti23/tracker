// Sidebar sections follow the notebook switch: a DSA group shows only DSA pages,
// Study Sites serves both notebooks, and Privacy (about the app, not study) sits in the footer.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'css', 'notebook.css'), 'utf8')  // the page's CSS lives in css/notebook.css
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

// Adi, 2026-11-27 (navigation redesign): the main content comes first. Dashboard, then the topics,
// then the study tools, which stay visible (they were moved out of a closed box on purpose, #268).
test('DSA sidebar: Dashboard first, then Topics, then Study tools', () => {
  const ids = Object.keys(sections()).filter(id => sections()[id].hub === 'dsa')
  assert.strictEqual(ids[0], 'nav-dashboard')
  assert.ok(nav.indexOf('<div id="nav-topics"') < nav.indexOf('>Study tools</p>'), 'topics before tools')
  assert.ok(nav.indexOf('id="nav-sd-tree"') < nav.indexOf('>Study tools</p>'), 'SD lessons before tools')
  assert.ok(!nav.includes('nav-howto'))
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

// Adi, 2026-11-26: a real interview loop mixes DSA, HLD, LLD and behavioral rounds, so interview
// experiences are their own notebook: a third switch button, and the sidebar then lists the companies.
test('Interview experiences is the third notebook: its sidebar lists the companies', () => {
  const s = sections()
  assert.deepStrictEqual([s['nav-google'].label, s['nav-google'].hub], ['Companies', 'exp'])
  assert.match(HTML, /<button type="button" data-mode="exp"[^>]*data-click="switchHub" data-args='\["exp"\]'[^>]*>.*💼.*Interviews<\/span><\/button>/)
  assert.match(HTML, /body\[data-hub-mode="exp"\] #sidebar \.sidebar-nav > :not\(\[data-hub="exp"\]\)/, 'only the companies show in that notebook')
})

test('opening Paper Club or Postmortems switches to the System Design notebook', () => {
  assert.match(HTML, /for \(const k of \['papers', 'postmortems'\]\) EMBEDS\[k\]\.hub = 'sd'/)
})

test('Privacy is in the sidebar footer with the "we collect nothing" line', () => {
  assert.ok(!nav.includes('id="nav-privacy"'))
  const footer = HTML.slice(HTML.indexOf('<div class="sidebar-footer">')).slice(0, 3200)
  assert.match(footer, /id="nav-privacy"[^>]*data-click="loadEmbed" data-args='\["privacy"\]'/)
  assert.match(footer, /We collect nothing\. Your progress stays in your browser and your own GitHub\./)
})
