'use strict'
// Adi, 2026-11-26: the 🧭 notes map on the left of System Design is good, but there has to be a way
// to hide it. « Hide puts it away (the cards take the full width), 🧭 Map brings it back, and the
// choice is remembered on this device. Skipped (not failed) when Playwright isn't installed.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

test('wide screen: « Hide puts the notes map away, 🧭 Map brings it back, and a reload remembers', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.setViewportSize({ width: 1500, height: 900 })
    await page.goto(base + '/sysdesign/system-design.html')
    const state = () => page.evaluate(() => ({
      rail: getComputedStyle(document.getElementById('rail')).display,
      show: getComputedStyle(document.getElementById('rail-show')).display,
      pad: getComputedStyle(document.body).paddingLeft,
    }))
    let s = await state()
    assert.equal(s.rail, 'block'); assert.equal(s.show, 'none'); assert.equal(s.pad, '260px')

    await page.click('#rail-hide')
    s = await state()
    assert.equal(s.rail, 'none', 'map hidden'); assert.equal(s.show, 'block', 'a way back'); assert.equal(s.pad, '0px', 'cards use the width')

    await page.reload()
    s = await state()
    assert.equal(s.rail, 'none', 'still hidden after a reload')

    await page.click('#rail-show')
    s = await state()
    assert.equal(s.rail, 'block'); assert.equal(s.show, 'none'); assert.equal(s.pad, '260px')
    assert.deepEqual(errors, [], 'no script errors')
  } finally { await browser.close(); server.close() }
})

test('narrow screen: no Hide or Map buttons (the map is already a drawer there)', { skip: SKIP }, async () => {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    await page.setViewportSize({ width: 1100, height: 900 })
    await page.goto(base + '/sysdesign/system-design.html')
    const s = await page.evaluate(() => [getComputedStyle(document.getElementById('rail-hide')).display, getComputedStyle(document.getElementById('rail-show')).display])
    assert.deepEqual(s, ['none', 'none'])
  } finally { await browser.close(); server.close() }
})
