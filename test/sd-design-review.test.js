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

test('the lit card is scrolled into view inside the rail', { skip: SKIP }, async () => {
  await withPage(1440, async page => {
    for (const id of ['sd-net-request', 'sd-reads-deep', 'sd-what-sd-tests']) {
      await scrollTo(page, id, 200)
      const inView = await page.evaluate(() => {
        const r = document.querySelector('#rail li.cur > a').getBoundingClientRect()
        return r.top >= 0 && r.bottom <= innerHeight
      })
      assert.equal(inView, true, `${id}: lit rail item is on screen`)
    }
  })
})

// Part 2: reading comfort and colour. Body text 17px (about 91 characters a line at full card
// width), the hub's font and surfaces, a small type scale, and selected chips that pass contrast.
const fs = require('fs')
const path = require('path')
const SD_CSS = (() => { const h = fs.readFileSync(path.join(__dirname, '..', 'sysdesign', 'system-design.html'), 'utf8'); return h.slice(h.indexOf('<style>'), h.indexOf('</style>')) })()

function contrast(a, b) {
  const lum = c => { const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test('the page uses the hub tokens and font, and only a small type scale at 12px and up', () => {
  const head = fs.readFileSync(path.join(__dirname, '..', 'sysdesign', 'system-design.html'), 'utf8').slice(0, 2000)
  assert.match(head, /href="\.\.\/css\/hub\.css"/)
  assert.match(SD_CSS, /--bg: var\(--bg-base\)/)
  assert.doesNotMatch(SD_CSS, /--accent: #/, 'the accent comes from the hub')
  // SVG text (fill:) scales with its drawing, and the one arrow glyph is decoration: both keep fixed sizes
  const textRules = SD_CSS.split('\n').filter(l => !/fill:|\.gh-ar/.test(l)).join('\n')
  const sizes = new Set((textRules.match(/font-size: *([0-9.]+)px/g) || []).map(s => parseFloat(s.split(':')[1])).filter(n => n >= 12 && n <= 19))
  assert.deepEqual([...sizes], [], 'text from 12px up uses the type scale tokens')
})

for (const theme of ['dark', 'light']) {
  test(`${theme}: body text is 17px and selected chips and tabs pass 4.5:1`, { skip: SKIP }, async () => {
    const { server, base } = await startServer()
    const { browser, context } = await openBrowser()
    try {
      await context.addInitScript(t => localStorage.setItem('dsa-theme', t), theme)
      const page = await context.newPage()
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(base + '/sysdesign/system-design.html')
      const m = await page.evaluate(() => {
        const cs = e => getComputedStyle(e)
        const p = document.querySelector('#sd-bitly-fast .bridge') || document.querySelector('#sd-bitly-fast p')
        const on = [document.querySelector('#chips button.on'), document.querySelector('#views button.on')]
        return { body: cs(p).fontSize, pairs: on.map(e => [cs(e).color, cs(e).backgroundColor]) }
      })
      assert.equal(m.body, '17px')
      for (const [fg, bg] of m.pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}:1`)
    } finally { await browser.close(); server.close() }
  })
}
