'use strict'
// Adi, 2026-11-25: the article-extractor prompt must not be public. It moves out of the page into
// a file of his private sync gist, and the box that shows it appears only for his GitHub login.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const MP = require('../sysdesign/my-prompts.js')

const ROOT = path.join(__dirname, '..')

function fakeDoc() {
  const mk = (tag) => {
    const e = { tagName: tag.toUpperCase(), children: [], hidden: false, attrs: {},
      appendChild(c) { this.children.push(c); return c }, setAttribute(k, v) { this.attrs[k] = v } }
    Object.defineProperty(e, 'textContent', {
      get() { return e._text !== undefined ? e._text : e.children.map((c) => c.textContent).join('') },
      set(v) { e._text = v === '' ? undefined : v; e.children = [] },
    })
    return e
  }
  return { createElement: mk, box: mk('details') }
}
const store = (o) => ({ getItem: (k) => (k in o ? o[k] : null) })
const OWNER_LS = { 'tracker-sync-token': 't', 'tracker-sync-gistid': 'g1', 'tracker-sync-login': MP.OWNER }
const find = (e, tag) => (e.tagName === tag ? e : e.children.map((c) => find(c, tag)).find(Boolean))

function run(ls, gistFiles, log) {
  const d = fakeDoc()
  const fetch = async (url, o) => {
    log && log.push([url, o && o.method || 'GET', o && o.body])
    return { ok: true, json: async () => ({ files: gistFiles }) }
  }
  return MP.mount(d.box, { document: d, localStorage: store(ls), fetch, navigator: {} }).then((state) => ({ state, box: d.box }))
}

test('someone else signed in sees nothing, and the gist is never read', async () => {
  const log = []
  const { state, box } = await run(Object.assign({}, OWNER_LS, { 'tracker-sync-login': 'someone' }), {}, log)
  assert.equal(state, 'hidden'); assert.equal(box.hidden, true); assert.deepEqual(log, [])
})

test('signed out sees nothing', async () => {
  const { state, box } = await run({}, {})
  assert.equal(state, 'hidden'); assert.equal(box.hidden, true)
})

test('the owner sees the prompt from the private gist, as text (never as HTML)', async () => {
  const { state, box } = await run(OWNER_LS, { [MP.FILE]: { content: 'Extract <b>everything</b>' } })
  assert.equal(state, 'show'); assert.equal(box.hidden, false)
  assert.equal(find(box, 'PRE').textContent, 'Extract <b>everything</b>')
})

test('with no prompt saved yet the owner gets an editor, and Save writes only that one gist file', async () => {
  const log = []
  const { state, box } = await run(OWNER_LS, {}, log)
  assert.equal(state, 'empty')
  find(box, 'TEXTAREA').value = 'my prompt'
  const save = box.children.map((c) => find(c, 'BUTTON')).find(Boolean)
  await save.onclick()
  const patch = log.find((l) => l[1] === 'PATCH')
  assert.ok(patch[0].endsWith('/gists/g1'))
  assert.deepEqual(JSON.parse(patch[2]), { files: { [MP.FILE]: { content: 'my prompt' } } })
})

test('the prompt text is no longer in the public page', () => {
  const html = fs.readFileSync(path.join(ROOT, 'sysdesign', 'system-design.html'), 'utf8')
  assert.doesNotMatch(html, /extractor-text|You are extracting a HelloInterview course lesson/)
  assert.match(html, /<details class="tool" id="my-prompts" hidden><\/details>/)
  assert.match(html, /<script src="my-prompts\.js"><\/script>/)
})

test('the prompt file is not a .json file, so sync never picks or uploads it as app data', () => {
  assert.doesNotMatch(MP.FILE, /\.json$/)
})
