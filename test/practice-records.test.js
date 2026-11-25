'use strict'
// Characterization tests for the notebook's per-question practice records (last-practiced,
// code-cooldown ladder, streak, solve counts). They pin the stored JSON shape and the rules,
// so moving these records from the inline script into js/data.js can't change either.
process.env.TZ = 'Asia/Kolkata'

const test = require('node:test')
const assert = require('node:assert')
const { loadApp, evalIn } = require('./load-app')

// A Date whose "now" is fixed; new Date(x) with arguments still works normally.
function fakeDate(nowMs) {
  return class extends Date {
    constructor(...a) { super(...(a.length ? a : [nowMs])) }
    static now() { return nowMs }
  }
}
function at(sandbox, iso) { sandbox.Date = fakeDate(Date.parse(iso)) }
const raw = (ls, k) => ls.getItem(k)

test('markPracticed stores an ISO time per question and starts the streak', () => {
  const { sandbox, localStorage } = loadApp()
  at(sandbox, '2026-11-16T03:00:00Z')
  sandbox.markPracticed('LC_1')
  assert.strictEqual(raw(localStorage, 'dsa-last-practiced-v1'), '{"LC_1":"2026-11-16T03:00:00.000Z"}')
  assert.strictEqual(sandbox.getLastPracticed('LC_1'), '2026-11-16T03:00:00.000Z')
  assert.strictEqual(sandbox.getLastPracticed('LC_2'), null)
  assert.strictEqual(raw(localStorage, 'dsa-streak-v1'), '{"date":"2026-11-16","streak":1,"longest":1}')
})

test('the code-cooldown ladder climbs 2, 4, 7, 14 and stays at 14; reset goes back to 2', () => {
  const { sandbox, localStorage } = loadApp()
  assert.strictEqual(sandbox.getReviewInterval('LC_1'), 1)
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(() => sandbox.bumpReviewInterval('LC_1')), [2, 4, 7, 14, 14])
  assert.strictEqual(raw(localStorage, 'dsa-review-interval-v1'), '{"LC_1":14}')
  assert.strictEqual(sandbox.resetReviewInterval('LC_1'), 2)
  assert.strictEqual(sandbox.getReviewInterval('LC_1'), 2)
})

test('raw/restore helpers put back exactly what was stored, including "never set"', () => {
  const { sandbox, localStorage } = loadApp()
  assert.strictEqual(sandbox._rawReviewInterval('LC_1'), undefined)
  sandbox.setReviewInterval('LC_1', 7)
  sandbox.setReviewInterval('LC_2', 4)
  sandbox._restoreReviewInterval('LC_1', undefined)
  assert.strictEqual(raw(localStorage, 'dsa-review-interval-v1'), '{"LC_2":4}')
  sandbox._restoreReviewInterval('LC_1', 2)
  assert.strictEqual(sandbox._rawReviewInterval('LC_1'), 2)

  localStorage.setItem('dsa-last-practiced-v1', '{"LC_1":"a","LC_2":"b"}')
  sandbox._restoreLastPracticed('LC_1', null)
  assert.strictEqual(raw(localStorage, 'dsa-last-practiced-v1'), '{"LC_2":"b"}')
  sandbox._restoreLastPracticed('LC_3', 'c')
  assert.strictEqual(raw(localStorage, 'dsa-last-practiced-v1'), '{"LC_2":"b","LC_3":"c"}')
})

test('streak: next local day adds one, a gap restarts at 1, longest is kept', () => {
  const { sandbox, localStorage } = loadApp()
  // 00:30 IST on 16 Nov is still 15 Nov in UTC: the streak must use the local day.
  for (const iso of ['2026-11-15T10:00:00Z', '2026-11-15T19:00:00Z']) { at(sandbox, iso); sandbox.markPracticed('LC_1') }
  assert.strictEqual(raw(localStorage, 'dsa-streak-v1'), '{"date":"2026-11-16","streak":2,"longest":2}')
  at(sandbox, '2026-11-17T12:00:00Z')
  assert.deepStrictEqual({ ...sandbox.getStreak() }, { streak: 2, longest: 2, today: false })
  at(sandbox, '2026-11-18T12:00:00Z')
  assert.deepStrictEqual({ ...sandbox.getStreak() }, { streak: 0, longest: 2, today: false })
  sandbox.markPracticed('LC_1')
  assert.strictEqual(raw(localStorage, 'dsa-streak-v1'), '{"date":"2026-11-18","streak":1,"longest":2}')
})

test('the same day twice counts once', () => {
  const { sandbox, localStorage } = loadApp()
  at(sandbox, '2026-11-16T03:00:00Z'); sandbox.markPracticed('LC_1')
  at(sandbox, '2026-11-16T15:00:00Z'); sandbox.markPracticed('LC_2')
  assert.strictEqual(raw(localStorage, 'dsa-streak-v1'), '{"date":"2026-11-16","streak":1,"longest":1}')
})

test('solve counts: +/- never go below zero and keep the { key: number } shape', () => {
  const { sandbox, localStorage } = loadApp()
  assert.strictEqual(sandbox.getSolveCount('LC_1'), 0)
  assert.strictEqual(sandbox.incSolveCount('LC_1'), 1)
  sandbox._adjSolveCount('LC_1', 1)
  sandbox._adjSolveCount('LC_2', -1)
  assert.strictEqual(raw(localStorage, 'dsa-solve-counts-v1'), '{"LC_1":2,"LC_2":0}')
  sandbox._adjSolveCount('LC_1', -5)
  assert.strictEqual(sandbox.getSolveCount('LC_1'), 0)
})

test('a corrupt stored record is never overwritten by a write', () => {
  const { sandbox, localStorage } = loadApp()
  for (const k of ['dsa-last-practiced-v1', 'dsa-review-interval-v1', 'dsa-streak-v1']) localStorage.setItem(k, '{bad')
  sandbox.markPracticed('LC_1')
  sandbox.setReviewInterval('LC_1', 4)
  sandbox._restoreReviewInterval('LC_1', 2)
  sandbox._restoreLastPracticed('LC_1', 'x')
  for (const k of ['dsa-last-practiced-v1', 'dsa-review-interval-v1', 'dsa-streak-v1']) assert.strictEqual(raw(localStorage, k), '{bad')
  assert.strictEqual(sandbox.getLastPracticed('LC_1'), null)
  assert.strictEqual(sandbox.getReviewInterval('LC_1'), 1)
  assert.deepStrictEqual({ ...sandbox.getStreak() }, { streak: 0, longest: 0, today: false })
})

test('a ✓ grade then a same-day change of mind leaves the records as they were', () => {
  const { sandbox, localStorage } = loadApp()
  at(sandbox, '2026-11-16T03:00:00Z')
  const { lcKey } = evalIn(sandbox, `(() => { const t = Object.keys(TOPIC_MODULES)[0]; return { lcKey: Object.keys(TOPIC_MODULES[t].questions)[0] } })()`)
  const keys = ['dsa-solve-counts-v1', 'dsa-review-interval-v1', 'dsa-last-practiced-v1']
  const before = keys.map(k => raw(localStorage, k))
  sandbox.gradeRevise(lcKey, 'solid'); sandbox._psCreditCleanSolve(lcKey)
  assert.notDeepStrictEqual(keys.map(k => raw(localStorage, k)), before)
  sandbox.gradeRevise(lcKey, 'shaky')
  assert.strictEqual(sandbox.getSolveCount(lcKey), 0)
  assert.strictEqual(sandbox._rawReviewInterval(lcKey), undefined)
  assert.strictEqual(sandbox.getLastPracticed(lcKey), null)
})
