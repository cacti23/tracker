'use strict'
// Adi, 2026-11-26: the live sidebar said v596 after PRs up to v605 had merged. The footer is typed
// by hand, and PRs from other threads named their commits vNNN without bumping it. This fails when
// the footer is older than the newest vNNN commit, so a PR can't merge with a stale number.
// Needs git history (CI checks out with fetch-depth: 0); skipped when there is none.
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '..')

function commitVersions() {
  try {
    const log = execFileSync('git', ['log', '--format=%s', '-n', '500'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return log.split('\n').map(s => /^v(\d+)\b/.exec(s)).filter(Boolean).map(m => Number(m[1]))
  } catch { return [] }
}
const versions = commitVersions()

test('the sidebar footer shows a version no older than the newest vNNN commit', { skip: !versions.length && 'no git history' }, () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const m = /<span>v(\d+) · Interview Prep Hub<\/span>/.exec(html)
  assert.ok(m, 'footer version line not found')
  const newest = Math.max(...versions)
  assert.ok(Number(m[1]) >= newest, `footer says v${m[1]} but commits go up to v${newest}: bump the footer in index.html`)
})
