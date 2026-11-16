// The AWS map (sysdesign/aws-map.js) is data-driven: traces name boxes, firewall rows and routes by id.
// A typo would silently draw nothing or show the wrong rule, so check every reference resolves.
const test = require('node:test')
const assert = require('node:assert')
const path = require('path')

const M = require(path.join(__dirname, '..', 'sysdesign', 'aws-map.js'))
const inBox = (p, b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h

test('every box sits inside the map, and inside the subnets it claims', () => {
  for (const [id, n] of Object.entries(M.NODES)) {
    assert.ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= M.MAP.W && n.y + n.h <= M.MAP.H, `${id} is off the map`)
    if (n.sg) assert.ok(M.SG[n.sg], `${id}: unknown Security Group ${n.sg}`)
    if (n.waf) assert.ok(M.WAF[n.waf], `${id}: unknown WAF ${n.waf}`)
    for (const s of n.in || []) assert.ok(M.SUBNETS[s], `${id}: unknown subnet ${s}`)
    // A box that lives in one subnet must be drawn inside it
    if (n.in && n.in.length === 1) {
      const s = M.SUBNETS[n.in[0]]
      assert.ok(n.x >= s.x && n.y >= s.y && n.x + n.w <= s.x + s.w && n.y + n.h <= s.y + s.h, `${id} is drawn outside ${n.in[0]}`)
    }
  }
  for (const [id, s] of Object.entries(M.SUBNETS)) {
    assert.ok(M.NACL[s.nacl], `${id}: unknown NACL ${s.nacl}`)
    assert.ok(M.RT[s.rt], `${id}: unknown route table ${s.rt}`)
  }
})

test('boxes never overlap each other', () => {
  const ns = Object.entries(M.NODES)
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const [a, A] = ns[i], [b, B] = ns[j]
    const apart = A.x + A.w <= B.x || B.x + B.w <= A.x || A.y + A.h <= B.y || B.y + B.h <= A.y
    assert.ok(apart, `${a} overlaps ${b}`)
  }
})

test('every trace step points at real boxes, real rule rows and on-map waypoints', () => {
  const ids = new Set(M.TRACES.map(t => t.id))
  assert.equal(ids.size, M.TRACES.length, 'trace ids must be unique')
  for (const t of M.TRACES) {
    assert.ok(t.steps.length && t.intro, `${t.id}: needs an intro and steps`)
    t.steps.forEach((s, k) => {
      const where = `${t.id} step ${k + 1}`
      assert.ok(s.cap, `${where}: no caption`)
      if (s.end) return
      assert.ok(s.p || s.at, `${where}: needs a path (p) or a box (at)`)
      assert.ok(['dns', 'in', 'out', 'rep', 'async', 'bad'].includes(s.k), `${where}: unknown colour ${s.k}`)
      if (s.at) assert.ok(M.NODES[s.at], `${where}: unknown box ${s.at}`)
      if (s.p) {
        assert.ok(s.p.length >= 2, `${where}: a path needs 2+ points`)
        assert.ok(!Array.isArray(s.p[0]) && !Array.isArray(s.p.at(-1)), `${where}: a path starts and ends at a box`)
        for (const p of s.p) {
          if (Array.isArray(p)) assert.ok(inBox(p, { x: 0, y: 0, w: M.MAP.W, h: M.MAP.H }), `${where}: waypoint ${p} is off the map`)
          if (Array.isArray(p)) for (const [id, n] of Object.entries(M.NODES)) assert.ok(!inBox(p, n), `${where}: waypoint ${p} sits on ${id}, so the line would hide under it`)
          else assert.ok(M.NODES[p], `${where}: unknown box ${p}`)
        }
      }
      for (const id of s.dead || []) assert.ok(M.NODES[id], `${where}: unknown dead box ${id}`)
      for (const id of Object.keys(s.ren || {})) assert.ok(M.NODES[id], `${where}: unknown renamed box ${id}`)
      for (const c of s.c || []) {
        if (c[0] === 'sg') {
          assert.ok(M.SG[c[1]], `${where}: unknown Security Group ${c[1]}`)
          if (c[2] !== 'reply') assert.ok(c[3] === -1 || M.SG[c[1]][c[2]][c[3]], `${where}: ${c[1]} has no ${c[2]} row ${c[3]}`)
        } else if (c[0] === 'nacl') {
          assert.ok(M.NACL[c[1]] && M.NACL[c[1]][c[2]], `${where}: unknown NACL ${c[1]} ${c[2]}`)
          assert.ok(c[3] === -1 || M.NACL[c[1]][c[2]][c[3]], `${where}: ${c[1]} has no ${c[2]} row ${c[3]}`)
        } else if (c[0] === 'rt') {
          assert.ok(M.RT[c[1]] && (c[2] === -1 || M.RT[c[1]].rows[c[2]]), `${where}: ${c[1]} has no row ${c[2]}`)
        } else if (c[0] === 'waf') {
          assert.ok(M.WAF[c[1]] && M.WAF[c[1]].rows[c[2]], `${where}: ${c[1]} has no row ${c[2]}`)
        } else assert.fail(`${where}: unknown check ${c[0]}`)
      }
      // A blocked step must show the checks it met
      if (s.x) assert.ok(s.c && s.c.length, `${where}: a blocked step needs its checks`)
    })
  }
})

test('every NACL ends with the catch-all deny, and Security Groups only allow', () => {
  for (const [id, a] of Object.entries(M.NACL)) for (const dir of ['in', 'out']) {
    const last = a[dir].at(-1)
    assert.deepEqual([last[0], last[3]], ['*', 'DENY'], `${id} ${dir} must end with * DENY`)
    const nums = a[dir].slice(0, -1).map(r => r[0])
    assert.deepEqual(nums, [...nums].sort((x, y) => x - y), `${id} ${dir} rules must be in number order`)
  }
  for (const [id, g] of Object.entries(M.SG)) for (const r of g.in) assert.equal(r.length, 3, `${id}: rows are [port, from, why]`)
})
