'use strict'
// Guards the file layout introduced by the 2026-10 reorg (flat files -> dsa/,
// apps/, google/, js/, docs/ folders with index.html kept at the repo root).
//
// What broke most easily in that kind of move: a relative href/src left
// pointing at where a file USED to be. These tests crawl every real HTML
// link/script/icon reference on disk and fail loudly, listing every broken
// one at once, if a target doesn't exist relative to the file that
// references it. They also pin down the specific cross-folder links the
// reorg depends on (index.html -> dsa/apps/google, dsa-master-map.html's
// link back to the root, the shared js/ and icons/ paths, the habits PWA's
// manifest/service-worker asset list) so a future file move trips a test
// instead of a silent 404 in the browser.
//
// Run with: node --test test/link-integrity.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function listFiles(dir, extFilter) {
  let out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out = out.concat(listFiles(full, extFilter))
    else if (extFilter(entry.name)) out.push(full)
  }
  return out
}

const htmlFiles = () => listFiles(ROOT, (name) => name.endsWith('.html'))

// Pulls every local href/src out of an HTML file: <script src=...> tags, plus
// <a href>, <link href>, <img src> in the markup. Inline <script>...</script>
// BODIES are stripped first (after grabbing any src= on the opening tag) so
// that JS which builds HTML strings at runtime (e.g. `'<a href="' + url +
// '">'`) can't be mistaken for a real static reference — that pattern is all
// over index.html's render functions and produced false positives otherwise.
function extractLocalRefs(filePath) {
  let html = fs.readFileSync(filePath, 'utf8')
  const refs = []
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"[^>]*>/gis)) refs.push(m[1])
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  for (const m of html.matchAll(/<(?:a|link|img)\b[^>]*?\s(?:href|src)="([^"]*)"[^>]*>/gis)) refs.push(m[1])
  return refs.filter((r) => r && !/^(https?:|mailto:|tel:|javascript:|data:|#)/i.test(r))
}

test('every local href/src/manifest/icon reference in every .html file resolves to a real file', () => {
  const broken = []
  for (const file of htmlFiles()) {
    const dir = path.dirname(file)
    for (const ref of extractLocalRefs(file)) {
      const clean = ref.split('#')[0] // strip in-page anchors like two-pointers.html#p-fast
      if (!clean) continue
      const target = path.join(dir, clean)
      if (!fs.existsSync(target)) {
        broken.push(`${path.relative(ROOT, file)} -> "${ref}" (resolved to ${path.relative(ROOT, target)}, which does not exist)`)
      }
    }
  }
  assert.deepEqual(broken, [], `broken local references found:\n  ${broken.join('\n  ')}`)
})

test('habits PWA manifest icon paths resolve relative to the manifest file', () => {
  const manifestPath = path.join(ROOT, 'apps', 'habits-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const dir = path.dirname(manifestPath)
  assert.ok(manifest.icons.length > 0, 'manifest should declare at least one icon')
  for (const icon of manifest.icons) {
    const target = path.join(dir, icon.src)
    assert.ok(fs.existsSync(target), `manifest icon "${icon.src}" does not resolve to a real file (${target})`)
  }
  // start_url/scope are resolved by the browser relative to the manifest's own
  // location, so habits.html must live in the same folder as the manifest.
  assert.ok(fs.existsSync(path.join(dir, manifest.start_url)), `manifest start_url "${manifest.start_url}" does not resolve`)
})

test('habits service worker caches only assets that actually exist', () => {
  const swPath = path.join(ROOT, 'apps', 'habits-sw.js')
  const src = fs.readFileSync(swPath, 'utf8')
  const match = src.match(/const ASSETS\s*=\s*\[([^\]]*)\]/)
  assert.ok(match, 'habits-sw.js should define a top-level const ASSETS = [...] array')
  const assets = [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2])
  assert.ok(assets.length > 0, 'ASSETS array should not be empty')
  const dir = path.dirname(swPath)
  for (const asset of assets) {
    const target = path.join(dir, asset)
    assert.ok(fs.existsSync(target), `service worker asset "${asset}" does not resolve to a real file (${target})`)
  }
})

test('index.html stays at the repo root and loads js/data.js + js/sync.js from there', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'index.html')), 'index.html must exist directly at the repo root')
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  assert.match(html, /<script src="js\/data\.js">/, 'index.html must load js/data.js')
  assert.match(html, /<script src="js\/sync\.js">/, 'index.html must load js/sync.js')
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'data.js')), 'js/data.js must exist (test/load-app.js hardcodes this path)')
  assert.ok(fs.existsSync(path.join(ROOT, 'js', 'sync.js')), 'js/sync.js must exist (test/sync.test.js hardcodes this path)')
})

test('index.html links out to every moved sub-app with the correct folder prefix', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const expectedLinks = [
    'dsa/dsa-master-map.html',
    'dsa/dsa-thoughts.html',
    'dsa/js-builtins.html',
    'apps/gym-5day.html',
    'apps/habits.html',
  ]
  for (const link of expectedLinks) {
    assert.match(html, new RegExp(`href="${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `index.html should link to ${link}`)
  }
})

test('Google opens in-pane from the sidebar (not a new tab) and embeds both google sub-pages', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  assert.match(html, /id="nav-google"[^>]*onclick="loadGoogle\(\)"/, 'sidebar Google entry must be a button calling loadGoogle()')
  assert.doesNotMatch(html, /<a[^>]*href="google\/[^"]*"[^>]*target="_blank"/, 'Google must not open in a new tab from the sidebar')
  assert.match(html, /id="view-google"/, 'index.html needs a #view-google pane')
  for (const f of ['google/google-interview-sources.html', 'google/google-onsite-log.html']) {
    assert.ok(html.includes(`'${f}'`), `loadGoogle() should embed ${f}`)
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} should exist`)
  }
})

test('dsa-master-map.html links back to the tracker root and to every pattern cheatsheet', () => {
  const mapPath = path.join(ROOT, 'dsa', 'dsa-master-map.html')
  const html = fs.readFileSync(mapPath, 'utf8')
  assert.match(html, /href="\.\.\/index\.html"/, 'dsa-master-map.html should link back to ../index.html')

  // Every dsa/*.html file except the map and the two standalone reference
  // pages (dsa-thoughts, js-builtins -- linked straight from index.html's
  // sidebar instead) is a pattern cheatsheet the map is supposed to
  // deep-link to. This catches both a broken link AND a new cheatsheet
  // silently added without a link to it.
  const dsaDir = path.join(ROOT, 'dsa')
  const standaloneReferencePages = new Set(['dsa-master-map.html', 'dsa-thoughts.html', 'js-builtins.html'])
  const patternFiles = fs.readdirSync(dsaDir)
    .filter((f) => f.endsWith('.html') && !standaloneReferencePages.has(f))
  assert.ok(patternFiles.length > 0, 'expected at least one pattern cheatsheet in dsa/')
  const missing = patternFiles.filter((f) => !html.includes(`href="${f}"`))
  assert.deepEqual(missing, [], `dsa-master-map.html is missing a link to: ${missing.join(', ')}`)
})

test('every app under apps/ that loads sync.js points at ../js/sync.js', () => {
  const appsDir = path.join(ROOT, 'apps')
  const appFiles = fs.readdirSync(appsDir).filter((f) => f.endsWith('.html'))
  for (const f of appFiles) {
    const html = fs.readFileSync(path.join(appsDir, f), 'utf8')
    if (/\bsync\.js\b/.test(html)) {
      assert.match(html, /<script src="\.\.\/js\/sync\.js">/, `${f} should load sync.js via ../js/sync.js`)
    }
  }
})

test('google-hub.html links to both google sub-pages, which exist alongside it', () => {
  const hubPath = path.join(ROOT, 'google', 'google-hub.html')
  const html = fs.readFileSync(hubPath, 'utf8')
  for (const link of ['google-interview-sources.html', 'google-onsite-log.html']) {
    assert.match(html, new RegExp(`href="${link}"`), `google-hub.html should link to ${link}`)
    assert.ok(fs.existsSync(path.join(ROOT, 'google', link)), `${link} should exist in google/`)
  }
})

test('habits-sw.js is registered with a path that scopes it to apps/, never the site root', () => {
  // A Service Worker's scope defaults to the DIRECTORY of the script URL it
  // was registered with. Before the reorg, habits.html + habits-sw.js lived
  // at the repo root, so register('habits-sw.js') silently scoped the worker
  // to the ENTIRE site -- it could intercept and serve stale cached HTML/JS
  // for index.html and every other page, not just the habits app. That's a
  // real, already-shipped landmine for anyone who'd opened the habits page
  // before this reorg: their browser may still be running that old,
  // root-scoped worker. This test guards against ever reintroducing an
  // absolute or parent-escaping registration path, which is the only thing
  // that can trigger that failure mode in newly-registered workers.
  const html = fs.readFileSync(path.join(ROOT, 'apps', 'habits.html'), 'utf8')
  const match = html.match(/navigator\.serviceWorker\.register\(\s*(['"])(.*?)\1/)
  assert.ok(match, 'habits.html should register a service worker')
  const registeredPath = match[2]
  assert.ok(!registeredPath.startsWith('/'), `service worker must be registered with a relative path, not an absolute one ("${registeredPath}") -- an absolute path scopes it to the whole site`)
  assert.ok(!registeredPath.includes('..'), `service worker registration path ("${registeredPath}") must not escape its own folder`)
  assert.ok(fs.existsSync(path.join(ROOT, 'apps', registeredPath)), `registered service worker "${registeredPath}" must live in apps/, alongside habits.html`)
})

test('every inline <script> block in every .html file is syntactically valid JavaScript', () => {
  // A reorg (or any bulk edit) can corrupt an inline script without touching
  // any href/src -- e.g. an unbalanced quote introduced by a sed pass. None
  // of the link checks above would catch that; a syntax error here means the
  // ENTIRE inline script silently fails to run in the browser (no console
  // access needed to notice -- the whole page stops working), which is this
  // exact bug class. Checked with `new vm.Script(...)`, i.e. parsed but not
  // executed, so this is safe to run against every file unconditionally.
  const vm = require('vm')
  const broken = []
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8')
    const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].filter((m) => !/<script\s+[^>]*\bsrc=/i.test(m[0]))
    for (const [i, block] of blocks.entries()) {
      const code = block[1].replace(/\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\//g, '')
      try {
        new vm.Script(code, { filename: `${path.relative(ROOT, file)} inline script #${i + 1}` })
      } catch (e) {
        broken.push(`${path.relative(ROOT, file)} inline script #${i + 1}: ${e.message}`)
      }
    }
  }
  assert.deepEqual(broken, [], `syntax errors found:\n  ${broken.join('\n  ')}`)
})

test('top-level folder layout matches the reorg contract', () => {
  const expectedDirs = ['js', 'dsa', 'apps', 'google', 'docs', 'icons', 'test']
  for (const d of expectedDirs) {
    assert.ok(fs.statSync(path.join(ROOT, d)).isDirectory(), `expected top-level directory "${d}" to exist`)
  }
  // Nothing from the old flat layout should still be sitting loose at the root.
  const rootEntries = fs.readdirSync(ROOT)
  const shouldNotBeAtRoot = [
    'data.js', 'sync.js', 'habits.html', 'habits-sw.js', 'habits-manifest.json',
    'gym-5day.html', 'google-hub.html',
    'google-interview-sources.html', 'google-onsite-log.html', 'dsa-master-map.html',
    'dsa-thoughts.html', 'backtracking.html', 'binary-search.html', 'bit-manipulation.html',
    'design.html', 'dp.html', 'graph.html', 'heap.html', 'intervals.html', 'linked-list.html',
    'recursion.html', 'sliding-window.html', 'sorting.html', 'stack.html', 'trees.html',
    'trie.html', 'two-pointers.html',
  ]
  const stillAtRoot = shouldNotBeAtRoot.filter((f) => rootEntries.includes(f))
  assert.deepEqual(stillAtRoot, [], `these files should have been moved out of the root but are still there: ${stillAtRoot.join(', ')}`)
})

// The 2026-10 reorg moved the cheat sheets into dsa/ but js/data.js still pointed at
// the old flat paths, so every topic's "Open Cheat Sheet" button 404'd. The HTML crawl
// above can't see links that JS builds at runtime, so check the data directly.
test('every topic in TOPICS has a cheatsheetUrl that resolves from the site root (where index.html runs)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8')
  const topicsBlock = src.slice(src.indexOf('const TOPICS = ['), src.indexOf('];', src.indexOf('const TOPICS = [')))
  const entries = [...topicsBlock.matchAll(/\{\s*key:\s*'([^']+)'[^}]*\}/g)]
  assert.ok(entries.length >= 16, 'expected to find the 16 topics, found ' + entries.length)
  const problems = []
  for (const [entry, key] of entries) {
    const m = entry.match(/cheatsheetUrl:\s*'([^']+)'/)
    if (!m) { problems.push(key + ': no cheatsheetUrl'); continue }
    if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push(key + ': ' + m[1] + ' does not exist')
  }
  assert.deepEqual(problems, [], 'broken cheat sheet links:\n' + problems.join('\n'))
})

test('every .html path written as a string literal in index.html or js/data.js resolves from the site root', () => {
  const broken = []
  for (const rel of ['index.html', path.join('js', 'data.js')]) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    for (const m of text.matchAll(/['"`]((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.html)(?:#[^'"`]*)?['"`]/g)) {
      if (!fs.existsSync(path.join(ROOT, m[1]))) broken.push(rel + ': ' + m[1])
    }
  }
  assert.deepEqual(broken, [], 'broken page links:\n' + broken.join('\n'))
})
