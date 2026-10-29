'use strict'
// What shows on each day in the To-do app (js/todo.js). Run with: node --test test/todo.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const T = require('../js/todo.js')

// 2026-10-26 is a Monday
const MON = '2026-10-26', TUE = '2026-10-27', WED = '2026-10-28', SAT = '2026-10-31'
const ids = rows => rows.map(r => r.task.id)

test('a one-off shows on its own day', () => {
  const tasks = { a: { id: 'a', text: 'Buy milk', repeat: 'once', date: MON, doneOn: null } }
  assert.deepEqual(ids(T.dayRows(tasks, {}, MON, MON).once), ['a'])
  assert.deepEqual(ids(T.dayRows(tasks, {}, TUE, MON).once), [], 'not on a future day it was not planned for')
})

test('an unfinished one-off carries over to today, a finished one does not', () => {
  const tasks = {
    a: { id: 'a', text: 'Unfinished', repeat: 'once', date: MON, doneOn: null },
    b: { id: 'b', text: 'Finished Monday', repeat: 'once', date: MON, doneOn: MON },
  }
  const today = T.dayRows(tasks, {}, WED, WED).once
  assert.deepEqual(ids(today), ['a'])
  assert.equal(today[0].carried, true)
  assert.equal(today[0].done, false)
  // On Tuesday (a past day, not today) it is not repeated
  assert.deepEqual(ids(T.dayRows(tasks, {}, TUE, WED).once), [])
  // On Monday it shows as moved on, b as done
  const mon = T.dayRows(tasks, {}, MON, WED).once
  assert.equal(mon.find(r => r.task.id === 'a').moved, true)
  assert.equal(mon.find(r => r.task.id === 'b').done, true)
})

test('a carried task ticked today stays on today as done', () => {
  const tasks = { a: { id: 'a', text: 'x', repeat: 'once', date: MON, doneOn: WED } }
  const rows = T.dayRows(tasks, {}, WED, WED).once
  assert.equal(rows.length, 1)
  assert.equal(rows[0].done, true)
})

test('repeating tasks follow their schedule and start date', () => {
  const daily = { id: 'd', text: 'Read', repeat: 'daily', days: [], start: TUE }
  const weekdays = { id: 'w', text: 'DSA', repeat: 'weekdays', days: [], start: MON }
  const days = { id: 's', text: 'Gym', repeat: 'days', days: [1, 6], start: MON }
  assert.equal(T.isScheduled(daily, MON), false, 'not before it started')
  assert.equal(T.isScheduled(daily, WED), true)
  assert.equal(T.isScheduled(weekdays, SAT), false)
  assert.equal(T.isScheduled(weekdays, TUE), true)
  assert.equal(T.isScheduled(days, MON), true)
  assert.equal(T.isScheduled(days, TUE), false)
  assert.equal(T.isScheduled(days, SAT), true)
})

test('repeating ticks are per day and do not carry over', () => {
  const tasks = { d: { id: 'd', text: 'Read', repeat: 'daily', days: [], start: MON } }
  const done = { [MON + '|d']: true, [TUE + '|d']: false }
  assert.equal(T.dayRows(tasks, done, MON, WED).recurring[0].done, true)
  assert.equal(T.dayRows(tasks, done, TUE, WED).recurring[0].done, false)
  assert.equal(T.dayRows(tasks, done, WED, WED).recurring[0].done, false)
  assert.equal(T.dayRows(tasks, done, WED, WED).once.length, 0, 'a missed repeat never shows as carried')
})

test('stopping a repeating task keeps it on past days only', () => {
  const tasks = { d: { id: 'd', text: 'Read', repeat: 'daily', days: [], start: MON, deletedOn: WED } }
  assert.equal(T.dayRows(tasks, {}, TUE, WED).recurring.length, 1)
  assert.equal(T.dayRows(tasks, {}, WED, WED).recurring.length, 0)
})

test('a deleted one-off is gone everywhere, including carry-over', () => {
  const tasks = { a: { id: 'a', text: 'x', repeat: 'once', date: MON, doneOn: null, deletedOn: '0000-00-00' } }
  assert.equal(T.dayRows(tasks, {}, MON, WED).once.length, 0)
  assert.equal(T.dayRows(tasks, {}, WED, WED).once.length, 0)
})

test('date helpers cross month ends and label schedules Monday-first', () => {
  assert.equal(T.addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(T.addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(T.repeatLabel({ repeat: 'days', days: [0, 1, 3] }), 'Mon · Wed · Sun')
  assert.equal(T.repeatLabel({ repeat: 'weekdays' }), 'Mon–Fri')
})
