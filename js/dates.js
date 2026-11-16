// Local calendar dates as 'YYYY-MM-DD', shared by the notebook, habits and gym apps.
// Never use toISOString().slice(0, 10) for "which day is it": that is the UTC date, so in IST
// (UTC+5:30) the day would roll over at 5:30 AM instead of midnight.
// `var` so it is a plain global in every page (and in the tests' vm sandboxes).
var LocalDate = {
  key(d) {
    const x = d || new Date()
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
  },
  // n calendar days after d (negative = before). setDate stays right across DST, unlike adding 86400000 ms.
  addDays(d, n) {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  },
}
