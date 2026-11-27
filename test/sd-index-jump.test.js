'use strict'
// Adi, 2026-11-27: on System Design the first click on a 🗂️ Index link landed far from its heading;
// going back to the top and clicking again worked. The cards render lazily (content-visibility), so the
// browser's jump moves as they grow, and the hash follower rewrote the hash before hashchange read it.
// The first click on a fresh page must land on the heading and keep it in the URL.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('first click on an Index link lands on its heading', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    for (const view of ['topics', 'courses']) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(base + '/sysdesign/system-design.html')
      if (view === 'courses') await page.click('#views button[data-view="courses"]')
      await page.click('#index summary')
      const hrefs = await page.$$eval('#index-body a', as => as.map(a => a.getAttribute('href')))
      const href = hrefs[Math.floor(hrefs.length / 2)]
      await page.click(`#index-body a[href="${href}"]`)
      await page.waitForTimeout(1200)
      const r = await page.evaluate(h => ({ hash: location.hash, top: document.getElementById(h.slice(1)).getBoundingClientRect().top }), href)
      assert.equal(r.hash, href, `${view}: the URL keeps the clicked heading`)
      assert.ok(Math.abs(r.top) < 40, `${view}: ${href} is at the top of the screen, not ${Math.round(r.top)}px away`)
      assert.deepEqual(errors, [], 'no script errors')
      await page.close()
    }
  } finally { await browser.close(); server.close() }
})
