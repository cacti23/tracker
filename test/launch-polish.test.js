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

test('the sidebar footer has a feedback email link', () => {
  assert.match(read('index.html'), /<a class="sidebar-feedback-link" href="mailto:[^"?]+@[^"?]+\?subject=Interview%20Prep%20Hub%20feedback">💬 Send feedback<\/a>/)
})

test('page titles match the sidebar names', () => {
  assert.match(read('dsa/how-to-use.html'), /<title>How to use the DSA tracker<\/title>/)
  assert.match(read('visuals/visuals.html'), /<title>DSA Visuals<\/title>/)
})
