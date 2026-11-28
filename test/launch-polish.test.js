// Before the public launch (Adi, 2026-11-26): no personal wording on public pages, a credit
// for the System Design notes, a link preview, a feedback email, and titles that match the sidebar.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const visible = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, '')

test('public pages carry no "Adi\'s notes" tags or first-person research notes', () => {
  const sd = visible(read('sysdesign/system-design.html'))
  assert.ok(!/Adi's notes|not in Adi's|example from Adi|Notes from our discussions/.test(sd))
  const g = visible(read('google/google-onsite-log.html'))
  assert.ok(!/\bI fetched\b|\bI could\b|\bI searched\b|confirmed by me/.test(g))
})

test('the System Design notes credit Hello Interview', () => {
  assert.match(read('sysdesign/system-design.html'), /<p class="credit">📚 Inspired by <a href="https:\/\/www\.hellointerview\.com\/[^"]*"[^>]*>Hello Interview's system design course<\/a>/)
})

test('sharing the hub shows a link preview with an image that exists', () => {
  const html = read('index.html')
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image']) assert.match(html, new RegExp(`<meta property="${p}" content="[^"]+">`), p)
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/)
  const img = /property="og:image" content="https:\/\/[^/]+\/([^"]+)"/.exec(html)[1]
  assert.ok(fs.existsSync(path.join(__dirname, '..', img)), img)
})

test('feedback goes through a Google Form, and no email address is printed on the hub', () => {
  const html = read('index.html')
  assert.match(html, /<a class="sidebar-feedback-link" href="https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform" target="_blank" rel="noopener">💬 Feedback<\/a>/)
  assert.ok(!/mailto:|@gmail\.com/.test(html))
})

test('page titles match the sidebar names', () => {
  assert.match(read('dsa/how-to-use.html'), /<title>How to use the DSA tracker<\/title>/)
  assert.match(read('visuals/visuals.html'), /<title>DSA Visuals<\/title>/)
})

test('the top bar links to the source on GitHub, so people can star it or contribute', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8')
  assert.match(html, /<a href="https:\/\/github\.com\/cacti23\/tracker" target="_blank" rel="noopener" class="header-menu-btn header-github" id="header-github"/)
})

test('the GitHub link invites pull requests and the repo is MIT licensed', () => {
  const fs = require('fs'), path = require('path')
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + require('./load-app').notebookSource()
  assert.match(html, /id="header-github"[^>]*>[\s\S]*?<span class="gh-label">PRs welcome<\/span><\/a>/)
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8'), /^MIT License/)
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8'), /## License\n\n\[MIT\]\(LICENSE\)/)
})
