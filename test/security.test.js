'use strict'
// Guards the token-exposure hardening: the GitHub sync token lives in localStorage, which every
// page on this origin shares, so any script that runs on any page could read it. Two layers:
//   1. every third-party <script>/<link stylesheet> is pinned with an SRI hash (a tampered CDN
//      file simply refuses to load), and
//   2. a Content-Security-Policy (vercel.json) that limits where scripts load from and — the
//      key part — where data can be SENT (connect-src), so an injected script can't ship the
//      token to an attacker's server.
// Run with: node --test test/security.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
function htmlFiles(dir = ROOT) {
  let out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out = out.concat(htmlFiles(full))
    else if (e.name.endsWith('.html')) out.push(full)
  }
  return out
}

test('every CDN script/stylesheet (cdnjs, jsdelivr) carries an integrity hash', () => {
  const bad = []
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(f, 'utf8')
    for (const m of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
      const t = m[0]
      if (/^<link/i.test(t) && !/stylesheet/i.test(t)) continue
      if (!/(?:src|href)="https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//.test(t)) continue
      if (!/integrity="sha(256|384|512)-/.test(t)) bad.push(`${path.relative(ROOT, f)}: ${t.slice(0, 110)}`)
    }
  }
  assert.deepEqual(bad, [], `unpinned third-party tags (add integrity + crossorigin):\n  ${bad.join('\n  ')}`)
})

test('no page loads a script from a host outside the allow-list', () => {
  const allowed = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//
  const bad = []
  for (const f of htmlFiles()) {
    const html = fs.readFileSync(f, 'utf8')
    for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi)) {
      if (!allowed.test(m[1])) bad.push(`${path.relative(ROOT, f)}: ${m[1]}`)
    }
  }
  assert.deepEqual(bad, [])
})

function csp() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  const h = cfg.headers.flatMap(x => x.headers).find(x => x.key === 'Content-Security-Policy')
  assert.ok(h, 'vercel.json must set a Content-Security-Policy header')
  const dirs = {}
  h.value.split(';').forEach(d => { const [k, ...v] = d.trim().split(/\s+/); if (k) dirs[k] = v })
  return dirs
}

test('CSP only lets the page send data to GitHub (and its own CDNs) — not arbitrary hosts', () => {
  const d = csp()
  assert.ok(d['connect-src'].includes('https://api.github.com'), 'sync needs api.github.com')
  assert.ok(d['connect-src'].includes('https://gist.githubusercontent.com'), 'sync needs gist raw_url')
  assert.ok(!d['connect-src'].includes('*') && !d['connect-src'].includes('https:'), 'connect-src must not be a wildcard — that is the token-exfiltration guard')
})

test('CSP locks down scripts, plugins, base URI and framing', () => {
  const d = csp()
  assert.deepEqual([...d['script-src']].sort(), ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'].sort())
  assert.deepEqual(d['object-src'], ["'none'"])
  assert.deepEqual(d['base-uri'], ["'self'"])
  assert.deepEqual(d['frame-ancestors'], ["'self'"])
})

test('the app makes no network calls that the CSP would block (only sync.js talks to GitHub)', () => {
  const offenders = []
  const files = htmlFiles().concat([path.join(ROOT, 'js', 'data.js'), path.join(ROOT, 'js', 'back-button.js')])
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    if (/\b(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource)\b/.test(src)) offenders.push(path.relative(ROOT, f))
  }
  assert.deepEqual(offenders, [], 'new network call found — if intentional, allow its host in vercel.json connect-src and update this test')
})
