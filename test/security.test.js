'use strict'
// Guards the token-exposure hardening: the GitHub sync token lives in localStorage, which every
// page on this origin shares, so any script that runs on any page could read it. Two layers:
//   1. no script comes from another site: Bootstrap and Prism are self-hosted in /vendor/, and
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

test('no page loads a script or stylesheet from another site (Bootstrap and Prism live in /vendor/)', () => {
  // Google Fonts CSS is the one outside stylesheet: it holds no script.
  const bad = []
  for (const f of htmlFiles()) {
    if (f.includes(`${path.sep}vendor${path.sep}`)) continue
    const html = fs.readFileSync(f, 'utf8')
    for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi)) bad.push(`${path.relative(ROOT, f)}: ${m[1]}`)
    for (const m of html.matchAll(/<link\b[^>]*stylesheet[^>]*>/gi)) {
      const href = (/href="([^"]+)"/.exec(m[0]) || [])[1] || ''
      if (/^https?:/.test(href) && !href.startsWith('https://fonts.googleapis.com/')) bad.push(`${path.relative(ROOT, f)}: ${href}`)
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

test('CSP only lets the page send data to GitHub (and Google Fonts) — not arbitrary hosts', () => {
  const d = csp()
  assert.ok(d['connect-src'].includes('https://api.github.com'), 'sync needs api.github.com')
  assert.ok(d['connect-src'].includes('https://gist.githubusercontent.com'), 'sync needs gist raw_url')
  assert.ok(!d['connect-src'].includes('*') && !d['connect-src'].includes('https:'), 'connect-src must not be a wildcard — that is the token-exfiltration guard')
})

test('CSP locks down scripts, plugins, base URI and framing', () => {
  const d = csp()
  // No CDN host: jsDelivr serves any npm package, so allowing it lets anyone's script run here.
  assert.deepEqual([...d['script-src']].sort(), ["'self'", "'unsafe-inline'"].sort())
  assert.ok(!d['img-src'].includes('https:'), 'img-src must list hosts: a wildcard lets an injected script send the token out as an image URL')
  assert.deepEqual(d['object-src'], ["'none'"])
  assert.deepEqual(d['base-uri'], ["'self'"])
  assert.deepEqual(d['frame-ancestors'], ["'self'"])
})

test('the app makes no network calls that the CSP would block (only sync.js talks to GitHub)', () => {
  const offenders = []
  const files = htmlFiles().concat([path.join(ROOT, 'js', 'data.js'), path.join(ROOT, 'js', 'back-button.js')])
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    // Constructor calls only: the System Design notes name WebSocket and EventSource in prose
    if (/\bfetch\(|\bXMLHttpRequest\b|\bsendBeacon\b|\bnew\s+(WebSocket|EventSource)\s*\(/.test(src)) offenders.push(path.relative(ROOT, f))
  }
  assert.deepEqual(offenders, [], 'new network call found — if intentional, allow its host in vercel.json connect-src and update this test')
})

test('extra security headers are set for every path', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  const keys = cfg.headers.find(x => x.source === '/(.*)').headers.map(h => h.key)
  for (const k of ['Strict-Transport-Security', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'X-Content-Type-Options', 'Referrer-Policy']) assert.ok(keys.includes(k), k)
})
