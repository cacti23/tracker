'use strict'
// A question card's action buttons (status, links, recall grade, solve ring) sit beside its
// title. They are about 390px wide and never shrink, so once the card is narrower than about
// 760px (a ~800px window with the sidebar open, or a phone) the title was squeezed into a
// column one word wide. Below that card width the title now takes the full row and the
// buttons move under it, wrapping if they still don't fit.
// Bootstrap's CSS is blocked in tests, so the sidebar doesn't share the row here; 700px gives
// the same narrow card that an ~800px window with the sidebar open gives in a real browser.
// Skipped (not failed) when Playwright isn't installed.
//
// Run with: node --test test/question-card-narrow.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

async function measure(width, sidebarCollapsed = '0') {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    await context.addInitScript(v => localStorage.setItem('dsa-sidebar-collapsed', v), sidebarCollapsed)
    const page = await context.newPage()
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/index.html')
    await page.evaluate(() => loadTopic('binary-search'))
    return await page.evaluate(() => {
      const item = document.querySelector('.accordion-item[data-lc-key]')
      const actions = item.querySelector('.q-header-actions')
      const r = el => el.getBoundingClientRect()
      return {
        item: r(item).width,
        title: r(item.querySelector('.q-title')).width,
        actionsOverflow: actions.scrollWidth - actions.clientWidth,
        actionsBelowTitle: r(actions).top >= r(item.querySelector('.q-title')).bottom - 1,
      }
    })
  } finally { await browser.close(); server.close() }
}

test('a wide card keeps the buttons beside the title', { skip: SKIP }, async () => {
  const m = await measure(1600)
  assert.ok(m.item > 760, 'precondition: wide card')
  assert.equal(m.actionsBelowTitle, false)
})

for (const width of [700, 390]) {
  test(`at ${width}px the title gets the full card width and the buttons fit under it`, { skip: SKIP }, async () => {
    const m = await measure(width)
    assert.ok(m.title >= m.item * 0.7, `title is ${Math.round(m.title)}px of a ${Math.round(m.item)}px card`)
    assert.equal(m.actionsBelowTitle, true, 'buttons sit under the title')
    assert.ok(m.actionsOverflow <= 0, 'buttons fit inside the card')
  })
}

test('any window under 900px stacks, even with the sidebar closed and a wide card', { skip: SKIP }, async () => {
  const m = await measure(880, '1')
  assert.ok(m.item > 760, 'precondition: the card itself is wider than the card rule')
  assert.equal(m.actionsBelowTitle, true, 'buttons sit under the title')
  assert.ok(m.title >= m.item * 0.7, `title is ${Math.round(m.title)}px of a ${Math.round(m.item)}px card`)
})

test('at 900px and above a wide card keeps the buttons beside the title', { skip: SKIP }, async () => {
  const m = await measure(900, '1')
  assert.equal(m.actionsBelowTitle, false)
})
