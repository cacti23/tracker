'use strict'
// Full-page boot smoke tests — the regression class this file exists to catch
// is "every other test is green, but the live page is blank."
//
// The rest of the suite (grading/sync/practice-clear/audit-fixes) tests pure
// state logic through loadApp(), whose document.getElementById always returns
// null. That's correct for state tests, but it means NOTHING in the suite
// ever actually calls buildNav(), fires DOMContentLoaded, or looks at what
// ends up inside #nav-topics — the exact code path a user hits on every page
// load. A broken global, a bad template-literal edit, or (as actually
// happened) a file-path assumption drifting out from under the data would
// have sailed through 51 green tests while the sidebar rendered empty in a
// real browser.
//
// These tests use loadAppWithDom() (see load-app.js) to boot the real
// index.html + data.js with a persistent fake DOM and the real
// DOMContentLoaded listeners fired, then assert on the resulting markup —
// so "the sidebar is empty" fails here, loudly, instead of reaching a user.
//
// Run with: node --test test/render-smoke.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadAppWithDom, evalIn } = require('./load-app')

test('booting the app renders every topic into the sidebar nav, with no exceptions', () => {
  const { sandbox, getElement } = loadAppWithDom()
  const topics = evalIn(sandbox, 'TOPICS')
  const topicModules = evalIn(sandbox, 'TOPIC_MODULES')

  assert.ok(Array.isArray(topics) && topics.length > 0, 'TOPICS must be a non-empty array')

  // topics/topicModules are objects from the vm context (a different realm),
  // so .map()/.filter() on them produce cross-realm Arrays. assert.deepEqual
  // in node:assert/strict is deepStrictEqual, which fails on those against a
  // host-realm `[]` even when structurally identical ("same structure but
  // not reference-equal") — Array.from() normalizes it back to a plain array.
  const orphanedTopics = Array.from(topics, (t) => t.key).filter((k) => !topicModules[k])
  assert.deepEqual(orphanedTopics, [], `TOPICS references topic key(s) with no TOPIC_MODULES entry: ${orphanedTopics.join(', ')}`)

  const nav = getElement('nav-topics')
  assert.ok(nav, 'buildNav() should populate #nav-topics')
  assert.notEqual(nav.innerHTML.trim(), '', 'REGRESSION GUARD: #nav-topics rendered empty after boot — this is the exact "no topics visible" bug class')

  for (const t of topics) {
    assert.match(nav.innerHTML, new RegExp(`id="nav-${t.key}"`), `sidebar is missing a nav button for topic "${t.key}"`)
    assert.match(nav.innerHTML, new RegExp(`onclick="loadTopic\\('${t.key}'\\)"`), `nav button for "${t.key}" must call loadTopic('${t.key}')`)
  }
})

test('every TOPICS entry has a matching, non-empty TOPIC_MODULES.questions set', () => {
  const { sandbox } = loadAppWithDom()
  const topicModules = evalIn(sandbox, 'TOPIC_MODULES')

  const problems = []
  for (const [tKey, mod] of Object.entries(topicModules)) {
    const qKeys = Object.keys(mod.questions || {})
    if (qKeys.length === 0) problems.push(`${tKey}: zero questions`)
    for (const qKey of qKeys) {
      if (!mod.questions[qKey].link) problems.push(`${tKey}/${qKey}: missing a "link" field`)
    }
  }
  assert.deepEqual(problems, [])
})

test('switching to every topic via loadTopic() renders its tracker and tabs with no exceptions', () => {
  const { sandbox, getElement } = loadAppWithDom()
  const topics = evalIn(sandbox, 'TOPICS')

  for (const t of topics) {
    assert.doesNotThrow(() => evalIn(sandbox, `loadTopic('${t.key}')`), `loadTopic('${t.key}') threw`)
    const title = getElement('page-title')
    assert.ok(title.textContent.includes(t.label), `#page-title should mention "${t.label}" after loadTopic('${t.key}')`)
  }
})

test('the dashboard and global search render without throwing', () => {
  const { sandbox } = loadAppWithDom()
  assert.doesNotThrow(() => evalIn(sandbox, 'loadDashboard()'), 'loadDashboard() threw')
  assert.doesNotThrow(() => evalIn(sandbox, "searchGlobalQuestions('two sum')"), 'searchGlobalQuestions() threw')
})
