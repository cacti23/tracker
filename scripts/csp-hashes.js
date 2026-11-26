#!/usr/bin/env node
'use strict'
// Pins every inline <script> of the site in the Content-Security-Policy (vercel.json).
//
// The CSP allows scripts from this site's own files, plus inline <script> blocks whose exact
// text matches one of the listed sha256 hashes. There is no 'unsafe-inline', so a script an
// attacker manages to inject (and every onclick="" attribute) is refused by the browser.
// The catch: changing an inline script changes its hash. After editing one, run
//
//     node scripts/csp-hashes.js          (rewrites the hash list in vercel.json)
//
// test/csp.test.js runs the same check (--check) and fails with this hint when they differ.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const VERCEL = path.join(ROOT, 'vercel.json')

// Every HTML page the site serves (vendor/ ships none with inline scripts).
function pages() {
  return walk(ROOT).filter((f) => !/^(vendor|test|node_modules|scripts)\//.test(f)).sort()
}
function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const rel = base ? base + '/' + d.name : d.name
    if (d.name.startsWith('.') || d.name === 'node_modules') return []
    return d.isDirectory() ? walk(path.join(dir, d.name), rel) : rel.endsWith('.html') ? [rel] : []
  })
}
// The text of each inline script, exactly as the browser hashes it.
function inlineScripts(html) {
  const out = []
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    if (/\ssrc\s*=/i.test(m[1] || '')) continue
    out.push(m[2])
  }
  return out
}
function hashes() {
  const set = new Set()
  for (const f of pages()) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n')
    for (const s of inlineScripts(html)) set.add("'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'")
  }
  return [...set].sort()
}
function cspEntry(cfg) {
  for (const block of cfg.headers) for (const h of block.headers) if (h.key === 'Content-Security-Policy') return h
  throw new Error('no Content-Security-Policy header in vercel.json')
}
function withScriptSrc(csp, list) {
  return csp.split(';').map((d) => {
    const t = d.trim()
    return t.startsWith('script-src ') ? ' ' + ["script-src 'self'"].concat(list).join(' ') : d
  }).join(';').replace(/^ /, '')
}

function main() {
  const cfg = JSON.parse(fs.readFileSync(VERCEL, 'utf8'))
  const entry = cspEntry(cfg)
  const want = withScriptSrc(entry.value, hashes())
  if (process.argv.includes('--check')) {
    if (want !== entry.value) {
      console.error('vercel.json script hashes are out of date. Run: node scripts/csp-hashes.js')
      process.exit(1)
    }
    return
  }
  if (want === entry.value) { console.log('vercel.json is up to date.'); return }
  entry.value = want
  fs.writeFileSync(VERCEL, JSON.stringify(cfg, null, 2) + '\n')
  console.log('Updated the script hashes in vercel.json.')
}

module.exports = { pages, inlineScripts, hashes }
if (require.main === module) main()
