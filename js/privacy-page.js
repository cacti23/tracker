// "Delete my data" on dsa/privacy.html. The work is in DataSync.deleteMyData (js/sync.js).
// Kept out of inline HTML so this page already works under a CSP without 'unsafe-inline'.
(function () {
  var btn = document.getElementById('deleteBtn')
  var out = document.getElementById('result')
  btn.addEventListener('click', function () {
    btn.disabled = true
    out.textContent = 'Working…'
    DataSync.deleteMyData().then(function (msg) {
      out.textContent = msg
      btn.disabled = false
      // The hub around this page still holds the old data in memory and would save it back:
      // reload the whole hub once something was erased.
      if (/^Done\./.test(msg)) setTimeout(function () { window.top.location.href = '/' }, 2500)
    })
  })
})()
