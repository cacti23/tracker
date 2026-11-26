// The System Design page links glossary words per card as it nears the screen, not all at
// load: linking all ~100 cards up front froze the hub (same thread) for 1-2 s on a phone.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const HTML = fs.readFileSync(path.join(__dirname, '..', 'sysdesign', 'system-design.html'), 'utf8')

test('glossary words are linked per card through an IntersectionObserver', () => {
  assert.match(HTML, /const linkCard = card => \{/)
  assert.match(HTML, /new IntersectionObserver\(es => es\.forEach\(e => \{\s*if \(e\.isIntersecting\) \{ io\.unobserve\(e\.target\); linkCard\(e\.target\) \}/)
  assert.ok(!/\n  cards\.forEach\(card => \{\n    \/\/ Walk in reading order/.test(HTML), 'no eager pass over every card')
})
