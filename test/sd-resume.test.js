'use strict'
// Adi, 2026-11-27: reloading the System Design notes started from the top, losing his place.
// A reload brings no hash (and the hub opens the notes without one), so the page goes back to the
// heading it last followed. A link with its own hash still wins, and the top stays the top.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('a reload goes back to the heading you were reading', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.setViewportSize({ width: 1400, height: 900 })
    const url = base + '/sysdesign/system-design.html'
    await page.goto(url)
    const ids = await page.$$eval('section.card h4[id]', hs => hs.map(h => h.id))
    const id = ids[Math.floor(ids.length / 2)]
    await page.goto(url + '#' + id)
    await page.waitForTimeout(1500)
    await page.mouse.wheel(0, 1) // the follower writes the heading it is under
    await page.waitForTimeout(400)
    const followed = await page.evaluate(() => location.hash)
    assert.ok(followed, 'the follower names a heading')

    await page.goto(url) // a reload, or the hub opening the notes: no hash
    await page.waitForTimeout(1500)
    const r = await page.evaluate(h => ({ hash: location.hash, top: document.getElementById(h.slice(1)).getBoundingClientRect().top }), followed)
    assert.equal(r.hash, followed, 'the URL names the same heading again')
    assert.ok(Math.abs(r.top) < 120, `${followed} is back near the top of the screen, not ${Math.round(r.top)}px away`)

    // A link to another heading wins over the saved one
    const other = ids[1]
    await page.goto(url + '#' + other)
    await page.waitForTimeout(1500)
    assert.equal(await page.evaluate(() => location.hash), '#' + other, 'a link keeps its own target')

    // Back at the very top, a reload stays at (or a few pixels from) the top
    await page.waitForTimeout(1000) // let the jump settle
    await page.mouse.wheel(0, 1) // the follower waits for the reader's own input before it rewrites the URL
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    await page.goto(url)
    await page.waitForTimeout(1200)
    assert.ok(await page.evaluate(() => scrollY < 300), 'the top stays the top')
    assert.deepEqual(errors, [], 'no script errors')
  } finally { await browser.close(); server.close() }
})
