'use strict'
// A value arriving from the gist (attacker model 1; this was an imported backup file until
// Import was removed on 2026-11-25) puts a topic note whose `id` carries markup. noteAccItem (index.html) concatenates n.id
// raw into id="..." and onclick='...', so opening the topic's Notes tab runs the attacker's
// inline handler. The production CSP (vercel.json) has script-src 'unsafe-inline' (inline
// handlers run) and img-src https: (any host), so before the fix such a handler could read the
// sync token. The payload here only sets a flag and requests a dummy host, nothing more.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('a topic-note id from synced data is escaped, not run as markup', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context, external } = await openBrowser()
  try {
    const page = await context.newPage()
    page.on('dialog', d => d.accept())
    await page.goto(base + '/index.html')

    const evilId = `x"><img src=nope onerror="window.__pwned=1;new Image().src='https://example.invalid/marker'">`
    const notes = JSON.stringify({ 'two-pointers': [{ id: evilId, title: 'Handy tricks', body: 'hello', pinned: false, updatedAt: 1 }] })
    // What a sync pull does: write the key, then reload.
    await page.evaluate(v => localStorage.setItem('dsa-topic-notes-v1', v), notes)
    await page.reload()
    await page.waitForLoadState('load')
    await page.evaluate(() => { loadTopic('two-pointers'); showTopicTab('notes') })
    await page.waitForTimeout(500)

    const pwned = await page.evaluate(() => !!window.__pwned)
    assert.deepEqual(external.filter(u => u.includes('example.invalid')), [], 'the injected handler made a request')
    assert.equal(pwned, false, 'the injected inline handler ran inside the notebook')
    // The note still works: its card is found by its (odd) id and opens on click.
    await page.click('.note-acc-head')
    assert.equal(await page.evaluate(id => document.getElementById('note-card-' + id).classList.contains('open'), evilId), true)
  } finally {
    await browser.close(); server.close()
  }
})
