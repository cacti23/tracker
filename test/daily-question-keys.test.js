'use strict'
// Engineering audit 2026-11-25. The daily question is stored under a key per day
// ('dsa-daily-question-' + Date#toDateString()), and nothing ever removed yesterday's.
// Every day the app was opened left one more key in localStorage, forever, sharing the
// ~5 MB origin quota with the real progress data and its three sync snapshots.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadApp } = require('./load-app')

const dailyKeys = (ls) => Object.keys(ls._dump()).filter(k => k.startsWith('dsa-daily-question-'))

for (const fn of ['getDailyQuestion', 'getRandomDailyQuestion']) {
  test(fn + ' keeps only today\'s daily-question key', () => {
    const { sandbox, localStorage } = loadApp()
    localStorage.setItem('dsa-daily-question-Mon Nov 23 2026', '{"lcKey":"x"}')
    localStorage.setItem('dsa-daily-question-Sun Jan 04 2026', '{"lcKey":"y"}')
    localStorage.setItem('dsa-progress-v1', '{}')
    const q = sandbox[fn]()
    assert.ok(q && q.lcKey)
    assert.deepEqual(dailyKeys(localStorage), ['dsa-daily-question-' + new Date().toDateString()])
    assert.equal(localStorage.getItem('dsa-progress-v1'), '{}')
  })
}

test('today\'s stored pick is still reused, key and shape unchanged', () => {
  const { sandbox } = loadApp()
  const first = sandbox.getDailyQuestion()
  assert.equal(sandbox.getDailyQuestion().lcKey, first.lcKey)
})
