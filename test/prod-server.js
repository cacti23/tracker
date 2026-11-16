'use strict'
// Helpers for browser tests: a static server for the repo root that sends the SAME headers as
// production (vercel.json, including the CSP), and a Playwright browser whose non-localhost
// requests are recorded and aborted (CDNs are blocked in the sandbox; the record is how a
// test sees an exfiltration attempt).
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }

function prodHeaders() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  const out = {}
  for (const h of cfg.headers[0].headers) out[h.key] = h.value
  return out
}

function startServer() {
  const headers = prodHeaders()
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(ROOT, p)
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, base: 'http://127.0.0.1:' + server.address().port })))
}

async function openBrowser() {
  const { chromium } = require('playwright')
  const browser = await chromium.launch()
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const external = []
  await context.route('**/*', route => {
    const u = route.request().url()
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return route.continue()
    external.push(u)
    return route.abort()
  })
  return { browser, context, external }
}

// Browser tests are skipped (not failed) where Playwright isn't installed, like the others.
let SKIP = false
try { require.resolve('playwright') } catch (e) { SKIP = 'playwright not installed' }

module.exports = { startServer, openBrowser, ROOT, SKIP }
