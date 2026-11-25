'use strict'
// System Design notes design review (Adi, 2026-11-25). The page is ~110,000px of notes, so a
// reader needs to see where they are. Part 1: a rail of the notes in the empty left margin on wide
// screens, a one-line trail that opens it as a drawer on narrower ones, a calmer card header, and
// small icon buttons on the section bands. Skipped (not failed) when Playwright isn't installed.
//
// Run with: node --test test/sd-design-review.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, openBrowser, SKIP } = require('./prod-server')

async function withPage(width, fn) {
  const { server, base } = await startServer()
  const { browser, context } = await openBrowser()
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/sysdesign/system-design.html')
    const out = await fn(page)
    assert.deepEqual(errors, [], 'no script errors')
    return out
  } finally { await browser.close(); server.close() }
}
const scrollTo = (page, id, extra = 300) => page.evaluate(([id, extra]) => {
  document.getElementById(id).scrollIntoView(); scrollBy(0, extra)
}, [id, extra]).then(() => page.waitForTimeout(250))

test('wide screen: the rail sits beside the cards and lights the card you are reading', { skip: SKIP }, async () => {
  await withPage(1440, async page => {
    await scrollTo(page, 'sd-bitly-fast', 1400)
    const m = await page.evaluate(() => {
      const rail = document.getElementById('rail').getBoundingClientRect()
      const card = document.getElementById('sd-bitly-fast').getBoundingClientRect()
      const cur = document.querySelector('#rail li.cur > a')
      return { railRight: rail.right, cardLeft: card.left, cur: cur && cur.getAttribute('href'),
        sections: document.querySelectorAll('#rail li.cur ol a').length,
        litSection: document.querySelector('#rail li.cur ol li.cur a')?.getAttribute('href') || '',
        trail: getComputedStyle(document.getElementById('here')).display }
    })
    assert.ok(m.railRight <= m.cardLeft, `rail (right ${m.railRight}) must not cover the card (left ${m.cardLeft})`)
    assert.equal(m.cur, '#sd-bitly-fast')
    assert.equal(m.sections, 3, 'the lit card opens to its 3 sections')
    assert.match(m.litSection, /^#sd-bitly-fast--/, 'the section you are in is lit too')
    assert.equal(m.trail, 'none', 'no trail when the rail is on screen')
  })
})

test('narrower screen: the trail names topic, card and section, and opens the rail as a drawer', { skip: SKIP }, async () => {
  await withPage(1100, async page => {
    await scrollTo(page, 'sd-cap-what', 1200)
    const trail = await page.evaluate(() => {
      const h = document.getElementById('here')
      return { hidden: h.hidden, top: h.getBoundingClientRect().top, text: h.textContent }
    })
    assert.equal(trail.hidden, false)
    assert.ok(Math.abs(trail.top) < 2, 'the trail sticks to the top')
    assert.match(trail.text, /CAP Theorem.*›.*What It Is/)
    await page.click('#here')
    const open = await page.evaluate(() => ({ open: document.getElementById('rail').classList.contains('open'),
      visible: document.getElementById('rail').getBoundingClientRect().width > 200,
      expanded: document.getElementById('here').getAttribute('aria-expanded') }))
    assert.deepEqual(open, { open: true, visible: true, expanded: 'true' })
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => document.getElementById('rail').classList.contains('open')), false, 'Esc closes it')
  })
})

test('the rail follows the view: lessons in Courses, topic filter in Topics, hidden on the AWS map', { skip: SKIP }, async () => {
  await withPage(1440, async page => {
    await page.click('#chips button:has-text("Caching")')
    const topics = await page.evaluate(() => [...document.querySelectorAll('#rail .g')].map(g => g.textContent))
    assert.deepEqual(topics, ['Caching'])
    await page.click('#views button[data-view=courses]')
    const groups = await page.evaluate(() => [...document.querySelectorAll('#rail .g')].map(g => g.textContent))
    assert.ok(groups.some(g => g.includes('Review: Bitly')), 'Courses view groups by lesson')
    assert.ok(!groups.includes('Designs'), 'no topic groups inside a lesson')
    await page.click('#views button[data-view=map]')
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).display), 'none')
  })
})

test('card header: title alone, then one meta line with the two buttons; sections get small icons', { skip: SKIP }, async () => {
  await withPage(1440, async page => {
    const m = await page.evaluate(() => {
      const c = document.getElementById('sd-net-request')
      const meta = c.querySelector(':scope > .cap + .meta')
      return { capKids: c.querySelector('.cap').children.length, where: meta?.querySelector('.where')?.textContent,
        cardBtns: meta ? meta.querySelectorAll('.quiz-btn').length : 0,
        bandIcons: [...c.querySelector(':scope > h4').querySelectorAll('.quiz-btn')].map(b => [b.textContent, !!b.getAttribute('aria-label')]),
        indexOpen: document.getElementById('index').open }
    })
    assert.equal(m.capKids, 1, 'only the title in the heading')
    assert.match(m.where, /^Networking · 🎓 02/)
    assert.equal(m.cardBtns, 2)
    assert.deepEqual(m.bandIcons, [['⚡', true], ['🧠', true]])
    assert.equal(m.indexOpen, false, 'the Index starts closed, so the first card is on the first screen')
  })
})
