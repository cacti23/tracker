/* ──────────────────────────────────────────────────────────────────────────
   TodoLogic: what shows on a given day in apps/todo.html. Pure functions, no DOM,
   so test/todo.test.js can check them directly.

   Two synced keys, both objects so sync.js can merge them entry by entry:
     todo_tasks_v1  { <id>: task }
       once:      { id, text, repeat: 'once', date, doneOn }   doneOn = day it was ticked, or null
       recurring: { id, text, repeat: 'daily' | 'weekdays' | 'days', days: [0-6], start }
       Deleting only sets deletedOn (never removes the entry), so a delete can't be undone
       by a merge with an older copy, and past days still show what was planned then.
     todo_done_v1   { '<date>|<id>': true | false }   ticks for recurring tasks
   Dates are local 'YYYY-MM-DD' strings, so plain string comparison orders them.
   ────────────────────────────────────────────────────────────────────────── */
(function (root) {
  'use strict';

  function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(s, n) {
    var d = parseDate(s);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }
  function weekday(s) { return parseDate(s).getDay(); }

  function alive(t, date) { return !t.deletedOn || date < t.deletedOn; }

  function isScheduled(t, date) {
    if (t.repeat === 'once' || date < t.start || !alive(t, date)) return false;
    var wd = weekday(date);
    if (t.repeat === 'daily') return true;
    if (t.repeat === 'weekdays') return wd >= 1 && wd <= 5;
    if (t.repeat === 'days') return (t.days || []).indexOf(wd) >= 0;
    return false;
  }

  // Rows for one day: { task, done, carried, moved }.
  //   carried: an unfinished one-off from an earlier day, shown on today.
  //   moved:   on a past day, a one-off that wasn't finished that day (it carried on).
  // Recurring tasks don't carry over: a missed day stays missed.
  function dayRows(tasks, done, date, today) {
    var recurring = [], once = [];
    Object.keys(tasks).forEach(function (id) {
      var t = tasks[id];
      if (!t || !t.text) return;
      if (t.repeat === 'once') {
        if (!alive(t, date)) return;
        if (t.date === date) {
          var doneThatDay = t.doneOn === date;
          once.push({ task: t, done: doneThatDay, carried: false, moved: date < today && !doneThatDay });
        } else if (date === today && t.date < today && (!t.doneOn || t.doneOn === today)) {
          once.push({ task: t, done: t.doneOn === today, carried: true, moved: false });
        }
      } else if (isScheduled(t, date)) {
        recurring.push({ task: t, done: done[date + '|' + t.id] === true, carried: false, moved: false });
      }
    });
    var byCreated = function (a, b) { return (a.task.createdAt || '') < (b.task.createdAt || '') ? -1 : 1; };
    recurring.sort(byCreated);
    once.sort(function (a, b) { return (a.carried === b.carried) ? byCreated(a, b) : (a.carried ? -1 : 1); });
    return { recurring: recurring, once: once };
  }

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function repeatLabel(t) {
    if (t.repeat === 'daily') return 'Every day';
    if (t.repeat === 'weekdays') return 'Mon–Fri';
    if (t.repeat === 'days') {
      // Monday-first, the way a week is read
      return [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return (t.days || []).indexOf(d) >= 0; })
        .map(function (d) { return DAY_NAMES[d]; }).join(' · ');
    }
    return 'Once';
  }

  var api = { fmtDate: fmtDate, parseDate: parseDate, addDays: addDays, isScheduled: isScheduled, dayRows: dayRows, repeatLabel: repeatLabel, DAY_NAMES: DAY_NAMES };
  root.TodoLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
