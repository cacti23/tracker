'use strict'
// State logic of apps/gym-5day.html: dates are stamped in local time, finishing a day clears
// its exercise checkmarks, and a PR's undo marker can't be orphaned by removing/replacing sets.
// The app is an IIFE that only exposes window.* functions, so it's loaded with its own small
// vm harness (load-app.js is specific to index.html) and a frozen clock.
process.env.TZ = 'Asia/Kolkata'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { makeLocalStorage, loadScripts } = require('./load-app')

const HTML = fs.readFileSync(path.join(__dirname, '..', 'apps', 'gym-5day.html'), 'utf8')
const APP_JS = [...HTML.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(m => !/<script\s+src=/.test(m[0]))
  .reduce((a, b) => (b[1].length > a[1].length ? b : a))[1]

// 00:30 on 16 Nov in IST is still 15 Nov in UTC.
const NOW = Date.parse('2026-11-15T19:00:00Z')

function fakeDate(nowMs) {
  return class extends Date {
    constructor(...a) { super(...(a.length ? a : [nowMs])) }
    static now() { return nowMs }
  }
}

function el() {
  const noop = () => {}
  return {
    style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null,
    querySelectorAll: () => [], innerHTML: '', textContent: '',
  }
}

function loadGym(nowMs = NOW, seed = {}) {
  const localStorage = makeLocalStorage()
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v))
  const noop = () => {}
  const window = { addEventListener: noop, scrollTo: noop, open: noop }
  const document = {
    getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el(), addEventListener: noop, body: el(), documentElement: el(),
  }
  const sandbox = { window, document, localStorage, console, JSON, Math, Date: fakeDate(nowMs), setTimeout, clearTimeout }
  vm.createContext(sandbox)
  loadScripts(sandbox, ['dates.js'])
  vm.runInContext(APP_JS, sandbox, { filename: 'gym-5day.html (inline script)' })
  const read = k => JSON.parse(localStorage.getItem(k) || 'null')
  return { w: window, read }
}

// Day 0, exercise 0 (no altB, so its key is the same in either week).
function logSet(w, setIdx, weight, reps) {
  w.setExerciseSetRep(0, 0, setIdx, 'weight', weight)
  w.setExerciseSetRep(0, 0, setIdx, 'reps', reps)
  w.toggleSetDone({ classList: { toggle() {} } }, 0, 0, setIdx)
}

test('PR and history are stamped with the local date, not the UTC one', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  logSet(w, 0, '60', '8')
  assert.strictEqual(read('gym5day_pr_v1')[name].date, '2026-11-16')
  w.saveDayToHistory(0)
  assert.strictEqual(read('gym5day_history_v1')[name].at(-1).date, '2026-11-16')
})

test('a workout on the next local day does not overwrite the previous day\'s entry', () => {
  const name0 = loadGym().w.getExerciseName(0, 0)
  // Last session saved the previous local evening (15 Nov).
  const seed = { gym5day_history_v1: { [name0]: [{ date: '2026-11-15', sets: [{ weight: '50', reps: '8' }] }] } }
  const { w, read } = loadGym(NOW, seed)
  w.setExerciseSetRep(0, 0, 0, 'weight', '55')
  w.setExerciseSetRep(0, 0, 0, 'reps', '8')
  w.saveDayToHistory(0)
  const hist = read('gym5day_history_v1')[name0]
  assert.deepStrictEqual(hist.map(h => h.date), ['2026-11-15', '2026-11-16'])
  assert.strictEqual(hist[0].sets[0].weight, '50')
})

test('finishing a day clears that day\'s exercise checkmarks', () => {
  const { w, read } = loadGym()
  w.toggleCheckbox({ dataset: { day: '0', ex: '0' }, classList: { toggle() {} } })
  assert.deepStrictEqual(read('gym5day_data')[0].completed, [0])
  w.setExerciseSetRep(0, 0, 0, 'weight', '60')
  w.setExerciseSetRep(0, 0, 0, 'reps', '8')
  w.saveDayToHistory(0)
  assert.deepStrictEqual(read('gym5day_data')[0].completed, [])
})

test('removing the set that set a PR reverts it to the previous record', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  logSet(w, 0, '60', '8')
  w.addSet(0, 0)
  logSet(w, 1, '600', '8')            // typo, ticked
  assert.strictEqual(read('gym5day_pr_v1')[name].weight, '600')
  w.removeSet(0, 0)
  assert.strictEqual(read('gym5day_pr_v1')[name].weight, '60')
})

test('switching variant reverts an unbanked PR set by the replaced sets', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  logSet(w, 0, '600', '8')
  assert.strictEqual(read('gym5day_pr_v1')[name].weight, '600')
  w.setVariant(0, 0, 1)
  assert.strictEqual(read('gym5day_pr_v1')[name], undefined)
})

test('a banked PR survives removing or replacing its set', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  w.addSet(0, 0)
  logSet(w, 1, '70', '5')
  w.saveDayToHistory(0)
  w.removeSet(0, 0)
  w.setVariant(0, 0, 1)
  assert.strictEqual(read('gym5day_pr_v1')[name].weight, '70')
})
