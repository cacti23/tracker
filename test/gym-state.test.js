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
  w.setExerciseSetRep(0, 0, 0, 'weight', '60')
  w.setExerciseSetRep(0, 0, 0, 'reps', '8')
  w.toggleCheckbox({ dataset: { day: '0', ex: '0' }, classList: { toggle() {} } })
  assert.strictEqual(w.isExDone(0, 0), true)
  w.saveDayToHistory(0)
  assert.strictEqual(w.isExDone(0, 0), false)
  assert.ok(read('gym5day_data')['X-0-0'].sets.every(s => !s.done && s.weight === '' && s.reps === ''))
})

test('removing the set that set a PR reverts it to the previous record', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  logSet(w, 0, '60', '8')
  w.addSet(0, 0)
  const last = w.getExerciseData(0, 0).sets.length - 1
  logSet(w, last, '600', '8')         // typo, ticked
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

// ---- Workout flow (v548): calendar week, fresh rows, bodyweight, progression, rest timer ----

test('Week A/B comes from the calendar, and the toggle shifts the whole rotation', () => {
  const { w, read } = loadGym()
  assert.strictEqual(['2026-11-16', '2026-11-23', '2026-11-29', '2026-11-30'].map(d => w.weekFor(d)).join(''), 'BAAB')
  w._toggleWeek()
  assert.deepStrictEqual(read('gym5day_week_v1'), { shift: 1 })
  assert.strictEqual(w.weekFor('2026-11-23'), 'B')
  assert.strictEqual((read('gym5day_nav') || {}).currentWeek, undefined)   // not remembered per device
})

test('an untouched exercise opens with the prescribed sets, and writing set 3 leaves no holes', () => {
  const { w, read } = loadGym()
  assert.strictEqual(w.getExerciseData(0, 0).sets.length, 4)   // Incline Barbell Press 4 × 6–8
  w.setExerciseSetRep(0, 0, 2, 'reps', '8')
  assert.ok(read('gym5day_data')['X-0-0'].sets.every(s => s && typeof s === 'object'))
})

test('a skipped exercise still showing last session\'s numbers is not saved as a new session', () => {
  const name0 = loadGym().w.getExerciseName(0, 0)
  const sets = [{ weight: '50', reps: '8' }]
  const seed = {
    gym5day_history_v1: { [name0]: [{ date: '2026-11-09', sets }] },
    gym5day_data: { 'X-0-0': { sets: [{ ...sets[0], done: false }], notes: '', variant: 0 } },
  }
  const { w, read } = loadGym(NOW, seed)
  assert.strictEqual(w.saveDayToHistory(0), 0)
  assert.deepStrictEqual(read('gym5day_history_v1')[name0].map(h => h.date), ['2026-11-09'])
})

test('ticking an empty row takes last session\'s numbers for that set', () => {
  const name0 = loadGym().w.getExerciseName(0, 0)
  const seed = { gym5day_history_v1: { [name0]: [{ date: '2026-11-09', sets: [{ weight: '50', reps: '8' }, { weight: '52.5', reps: '6' }] }] } }
  const { w, read } = loadGym(NOW, seed)
  w.toggleSetDone({ classList: { toggle() {} } }, 0, 0, 1)
  const s = read('gym5day_data')['X-0-0'].sets[1]
  assert.deepStrictEqual([s.weight, s.reps, s.done], ['52.5', '6', true])
})

test('bodyweight sets and comma decimals count for PRs', () => {
  const { w, read } = loadGym()
  const name = w.getExerciseName(0, 0)
  logSet(w, 0, '', '12')
  assert.deepStrictEqual([read('gym5day_pr_v1')[name].weight, read('gym5day_pr_v1')[name].reps], ['0', '12'])
  logSet(w, 1, '62,5', '6')
  assert.strictEqual(read('gym5day_pr_v1')[name].weight, '62.5')
})

test('progression tip: top of the range adds 2.5 kg, otherwise one more rep', () => {
  const { w } = loadGym()
  const rx = w.parsePrescription('4 × 6–8')
  assert.strictEqual(w.progressionTip({ w: 60, r: 8 }, rx), '62.5kg × 6')
  assert.strictEqual(w.progressionTip({ w: 60, r: 7 }, rx), '60kg × 8')
  assert.strictEqual(w.progressionTip({ w: 0, r: 15 }, w.parsePrescription('3 × 12–15')), 'BW × 16 (or add weight)')
  assert.strictEqual(JSON.stringify(w.parsePrescription('4 × 5')), '{"count":4,"lo":5,"hi":5}')
})

test('rest times are read from the plan text, low end first', () => {
  const { w } = loadGym()
  const cases = { '2–3 min': 120, '90s–2 min': 90, '30–45s': 30, '60s after pair': 60, '2 min': 120, '→ superset, no rest': 0, '75s': 75 }
  for (const [txt, secs] of Object.entries(cases)) assert.strictEqual(w.restSeconds(txt), secs, txt)
})

test('ticking a set starts the rest timer; the first half of a superset does not', () => {
  const { w, read } = loadGym()
  logSet(w, 0, '60', '8')
  assert.strictEqual(read('gym5day_rest').endAt, NOW + 120 * 1000)
  w._restSkip()
  assert.strictEqual(read('gym5day_rest'), null)
  w.setExerciseSetRep(3, 2, 0, 'reps', '15')   // Thu lateral raise, "→ superset, no rest"
  w.toggleSetDone({ classList: { toggle() {} } }, 3, 2, 0)
  assert.strictEqual(read('gym5day_rest'), null)
})

test('matching an old record is not shown as a new PR', () => {
  const name0 = loadGym().w.getExerciseName(0, 0)
  const { w } = loadGym(NOW, { gym5day_pr_v1: { [name0]: { weight: '60', reps: '8', date: '2026-11-09' } } })
  logSet(w, 0, '60', '8')
  assert.strictEqual(w.isRecordSet(0, 0, 0), false)
  logSet(w, 1, '60', '9')
  assert.strictEqual(w.isRecordSet(0, 0, 1), true)
})

test('warm-up ramp: 50% × 8 then 75% × 4 of today\'s work weight, bodyweight lifts get their own', () => {
  const { w } = loadGym()
  const rx = w.parsePrescription('4 × 6–8')
  assert.strictEqual(w.warmupLine('Incline Barbell Press', { w: 60, r: 7 }, rx), '30kg × 8 → 45kg × 4')
  assert.strictEqual(w.warmupLine('Incline Barbell Press', { w: 60, r: 8 }, rx), '32.5kg × 8 → 47.5kg × 4')   // today is 62.5
  assert.strictEqual(w.warmupLine('Weighted Pull-up', null, rx), 'BW × 5 → then add the belt')
})

test('plan rules: at most one leg move on an upper-body day, both weeks', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps', 'gym-5day.html'), 'utf8')
  const days = vm.runInNewContext('(' + html.match(/const days = (\[[\s\S]*?\n  \]);/)[1] + ')')
  for (const day of days.filter(d => d.type === 'push' || d.type === 'pull')) {
    for (const wk of ['A', 'B']) {
      const names = day.exercises.map(e => (wk === 'B' && e.altB ? e.altB : e).name)
      const legs = names.filter(n => /leg press|squat|lunge|calf|leg curl|leg extension/i.test(n))
      assert.ok(legs.length <= 1, `${day.tag} week ${wk}: ${legs.join(', ')}`)
    }
  }
})
