'use strict'
// "Sign in with GitHub" for cloud sync: a Vercel serverless function (Node) running GitHub's
// OAuth web flow. It exists because turning GitHub's one-time code into a token needs the OAuth
// app's client secret, which must never reach the browser. The token it returns is the same
// thing a user used to paste by hand: scope "gist", used only by js/sync.js.
//
//   GET /api/github-oauth?return=/apps/habits.html   → 302 to GitHub's "Authorize?" page
//   GET /api/github-oauth?code=…&state=…             → 302 back to that page with the token
//                                                       in the URL fragment (#tracker-signin=…)
//
// The token travels in the fragment, not the response body: a fragment is never sent to a
// server or stored in a service-worker cache, and sync.js removes it from the address bar at
// once. Nothing is stored here; each user's data stays in their own private gist.
//
//   POST /api/github-oauth?action=revoke              → cancels the caller's token at GitHub
//        (Authorization: Bearer <token>)                (sign-out and "Delete my data")
//   POST /api/github-oauth?action=refresh             → a fresh 8-hour token (GitHub App only)
//
// Two kinds of sign-in, picked by which keys the Vercel project has:
//   • GitHub App (GITHUB_APP_CLIENT_ID + GITHUB_APP_CLIENT_SECRET), preferred. Its tokens
//     (ghu_…) expire after 8 hours. The refresh token that renews them (ghr_…, 6 months) never
//     reaches page scripts: it lives in an HttpOnly cookie scoped to this function, so a script
//     injected into the page could steal at most an 8-hour token, never a lasting one.
//     Like a hotel: the room card expires, the front desk keeps the master and prints new cards.
//   • OAuth App (GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET), the original. Tokens (gho_…) never
//     expire. Used for sign-in only when the App keys are missing; still used to cancel gho_
//     tokens at sign-out, so keep these keys until every device has signed in again.
//
// Setup (once): create a GitHub App (Account permissions → Gists: Read and write; callback URL
// https://<site>/api/github-oauth; "Expire user authorization tokens" on; webhook off), then set
// GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET in the Vercel project's environment variables.
// Optional PUBLIC_ORIGIN (e.g. https://tracker-roan-nine.vercel.app) fixes the callback host
// instead of reading it from the request.

const crypto = require('crypto')

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const REVOKE_URL = (id) => `https://api.github.com/applications/${encodeURIComponent(id)}/token`
const COOKIE = 'tracker_oauth'
const COOKIE_ATTRS = 'Path=/api/github-oauth; HttpOnly; Secure; SameSite=Lax'
// Strict: only this site's own pages can make the browser send it, and only to this function.
const REFRESH_COOKIE = 'tracker_refresh'
const REFRESH_ATTRS = 'Path=/api/github-oauth; HttpOnly; Secure; SameSite=Strict'
const clearRefresh = `${REFRESH_COOKIE}=; ${REFRESH_ATTRS}; Max-Age=0`

// The keys for each kind of sign-in, or null when that kind isn't set up.
function creds(kind) {
  const env = process.env
  const id = kind === 'app' ? env.GITHUB_APP_CLIENT_ID : env.GITHUB_CLIENT_ID
  const secret = kind === 'app' ? env.GITHUB_APP_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET
  return id && secret ? { kind, clientId: id, secret } : null
}
// Sign-in prefers the GitHub App; the OAuth App is the fallback until its keys exist.
function signInCreds() { return creds('app') || creds('oauth') }
// A token says which kind issued it: ghu_ (GitHub App user token) or gho_ (OAuth App).
function credsForToken(token) { return /^ghu_/.test(token) ? creds('app') : /^gho_/.test(token) ? creds('oauth') : null }
function refreshCookie(token, seconds) {
  const age = Math.max(60, Math.min(Number(seconds) || 15897600, 15897600))   // GitHub's default: ~6 months
  return `${REFRESH_COOKIE}=${encodeURIComponent(token)}; ${REFRESH_ATTRS}; Max-Age=${age}`
}
function sameSite(req, origin, host) {
  const from = req.headers.origin
  return !from || from === origin || from === `https://${host}`
}

// Only a same-site path may be the return target, so this can't redirect anyone elsewhere.
function safeReturn(p) {
  if (typeof p !== 'string' || p.length > 200) return '/'
  if (!/^\/(?![/\\])[A-Za-z0-9._~\-/?=&%]*$/.test(p)) return '/'
  return p
}

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return ''
}

function sameString(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

function redirect(res, location, cookie) {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  if (cookie && cookie.length) res.setHeader('Set-Cookie', cookie)
  res.end()
}

function page(res, status, message) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>GitHub sign-in</title><body style="font:16px system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem">` +
    `<p>${esc(message)}</p><p><a href="/">← Back to the tracker</a></p></body>`)
}

module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = (process.env.PUBLIC_ORIGIN || `https://${host}`).replace(/\/+$/, '')
  const callback = `${origin}/api/github-oauth`
  const q = new URL(req.url, callback).searchParams

  if (q.get('action') === 'revoke') return revoke(req, res, { origin, host })
  if (q.get('action') === 'refresh') return refresh(req, res, { origin, host })

  const signIn = signInCreds()
  if (!signIn) return page(res, 500, 'GitHub sign-in is not set up on this site yet. You can still sync by pasting a token.')
  const { clientId, secret } = signIn

  // Step 1: send the user to GitHub. The random state, kept in a short-lived cookie, proves the
  // callback belongs to a sign-in this browser started (stops a forged callback logging the
  // user into someone else's account).
  if (!q.has('code') && !q.has('error')) {
    const state = crypto.randomBytes(16).toString('hex')
    const back = safeReturn(q.get('return'))
    // An OAuth App asks for the gist scope; a GitHub App's access comes from its permissions
    // (Gists only), so it takes no scope.
    const params = new URLSearchParams(signIn.kind === 'app'
      ? { client_id: clientId, redirect_uri: callback, state }
      : { client_id: clientId, redirect_uri: callback, scope: 'gist', state })
    return redirect(res, `${AUTHORIZE_URL}?${params}`, `${COOKIE}=${state}.${encodeURIComponent(back)}; ${COOKIE_ATTRS}; Max-Age=600`)
  }

  // Step 2: GitHub sent the user back.
  const clear = `${COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`
  const saved = readCookie(req.headers.cookie, COOKIE)
  const dot = saved.indexOf('.')
  const state = dot > 0 ? saved.slice(0, dot) : ''
  let back = '/'
  try { back = safeReturn(decodeURIComponent(saved.slice(dot + 1))) } catch (e) {}
  if (!state || !sameString(state, q.get('state') || '')) {
    return page(res, 400, 'This sign-in link expired or was started in another browser. Go back and tap Sign in with GitHub again.')
  }
  if (q.has('error')) return redirect(res, `${back}#tracker-signin-error=${encodeURIComponent(q.get('error'))}`, clear)

  let body = {}
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: secret, code: q.get('code'), redirect_uri: callback }),
    })
    body = await r.json()
  } catch (e) {
    body = { error: 'github_unreachable' }
  }
  if (!body || typeof body.access_token !== 'string' || !body.access_token) {
    return redirect(res, `${back}#tracker-signin-error=${encodeURIComponent((body && body.error) || 'token_exchange_failed')}`, clear)
  }
  // A GitHub App token expires: tell the page when, and keep its refresh token in the cookie.
  const expires = Number(body.expires_in) > 0 ? `&expires_in=${Math.floor(Number(body.expires_in))}` : ''
  const cookies = [clear]
  if (typeof body.refresh_token === 'string' && body.refresh_token) cookies.push(refreshCookie(body.refresh_token, body.refresh_token_expires_in))
  return redirect(res, `${back}#tracker-signin=${encodeURIComponent(body.access_token)}${expires}`, cookies.length === 1 ? cookies[0] : cookies)
}

// A fresh 8-hour token from the refresh cookie (GitHub App sign-ins only). GitHub hands out a new
// refresh token each time (the old one stops working), so the cookie is replaced. A failure leaves
// the cookie alone: another tab may have just renewed it, and clearing it would sign that tab out.
async function refresh(req, res, { origin, host }) {
  const json = (status, body, cookie) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    if (cookie) res.setHeader('Set-Cookie', cookie)
    res.end(JSON.stringify(body))
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!sameSite(req, origin, host)) return json(403, { error: 'forbidden' })
  const app = creds('app')
  if (!app) return json(404, { error: 'not_configured' })
  let token = ''
  try { token = decodeURIComponent(readCookie(req.headers.cookie, REFRESH_COOKIE)) } catch (e) {}
  if (!/^ghr_[A-Za-z0-9_]{1,255}$/.test(token)) return json(401, { error: 'no_refresh_token' })
  let body = {}
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: app.clientId, client_secret: app.secret, grant_type: 'refresh_token', refresh_token: token }),
    })
    body = await r.json()
  } catch (e) {
    return json(502, { error: 'github_unreachable' })
  }
  if (!body || typeof body.access_token !== 'string' || !body.access_token) return json(401, { error: (body && body.error) || 'refresh_failed' })
  const cookie = typeof body.refresh_token === 'string' && body.refresh_token ? refreshCookie(body.refresh_token, body.refresh_token_expires_in) : undefined
  return json(200, { access_token: body.access_token, expires_in: Number(body.expires_in) || 0 }, cookie)
}

// Sign-out: OAuth App tokens never expire, so deleting one from the browser is not enough. A
// copied or stolen token would keep working. Only the app's own secret can cancel it, so the
// browser asks this function. Only POSTs from this site's own pages are served.
// Also drops this browser's refresh cookie, so a signed-out browser can't renew a token.
async function revoke(req, res, { origin, host }) {
  const done = (status) => { res.statusCode = status; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Set-Cookie', clearRefresh); res.end() }
  if (req.method !== 'POST') return done(405)
  if (!sameSite(req, origin, host)) return done(403)
  const m = /^Bearer (gh[ou]_[A-Za-z0-9_]{1,255})$/.exec(req.headers.authorization || '')
  if (!m) return done(400)   // a pasted personal token is not this app's to cancel
  const c = credsForToken(m[1])
  if (!c) return done(400)   // the keys that issued it are gone: nothing here can cancel it
  try {
    const r = await fetch(REVOKE_URL(c.clientId), {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Basic ' + Buffer.from(`${c.clientId}:${c.secret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: m[1] }),
    })
    // 404: already cancelled, or not issued by this app. Either way it no longer works here.
    return done(r.status === 204 || r.status === 404 ? 204 : 502)
  } catch (e) {
    return done(502)
  }
}

module.exports.safeReturn = safeReturn
