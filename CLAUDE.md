# CLAUDE.md

Static site (no build, no package.json). The main app is `index.html` (DSA Notebook). See `README.md` for the layout and how to run it.

## Run and test

- Serve the repo root: `python3 -m http.server 8000`
- Tests: `node --test --test-concurrency=6 test/*.test.js` (about 13 s; CI runs the same). All of them should pass before you push. Test files run side by side, so each file must build its own state (server, browser, fake cloud) and never rely on another file. Inside `test/sync-races.test.js` the tests also run side by side (each makes its own cloud and devices), so keep new tests there self-contained.

## How the code is organised

- **App logic is one big inline `<script>` in `index.html`.** Data and localStorage helpers are in `js/data.js`. `data.js` holds data and data-access helpers only, with no rendering or DOM code; that includes the per-question practice records (solve counts, last practiced, cooldown ladder, streak), built on its `_jsonMap` helper. `js/dates.js` (`LocalDate.key`, `LocalDate.addDays`) is the one local-date helper for all three apps: never use `toISOString().slice(0, 10)` for a day.
- Tests load the app by taking the **largest inline `<script>` block** from `index.html` (`test/load-app.js`), after the `js/` files listed in `PAGE_SCRIPTS` there. Don't split the inline script into several large blocks, and don't add a bigger inline block, without updating that loader.
- Top-level `let`/`const` in the inline script are not reachable as globals from the tests. Use `evalIn` in `test/load-app.js`.
- The notebook's own CSS is in `css/notebook.css` (shared tokens stay in `css/hub.css`). Tests that check CSS read both `index.html` and that file.
- Cheat-sheet CSS shared by every page of a style lives in `css/notes.css` (the `dsa/*.html` sheets) and `css/notes-notion.css` (backtracking, dp, recursion). Each page keeps its own `:root` colours and extras inline, after the link. Change shared look there, not per page.
- System design page data lives outside its inline script: `sysdesign/seqs.js` (`SEQS`, the 🎞️ sequence animations) and `sysdesign/glossary.js` (`GLOSSARY`). They are plain scripts loaded before the inline one, so editing them needs no CSP hash update.
- Adding a topic: add it to `TOPICS` and `TOPIC_MODULES` in `js/data.js` (the module schema is documented in that file), and add a cheatsheet in `dsa/`.
- `escHtml()` should wrap any user or data text put into `innerHTML`.
- **No inline event handlers, no 'unsafe-inline'.** The CSP in `vercel.json` allows scripts from `'self'` plus each inline `<script>` block pinned by its sha256 hash. Handlers are `data-click="name" data-args='[...]'` (also `data-input`, `data-keydown` + `data-key`, `data-focusout`, `data-toggle`, `data-error`, `data-stop`, `data-prevent`; see `js/actions.js`), and a page must `Actions.register` every name it uses (index.html: the ACTIONS block before SYNCED KEYS). In HTML built by scripts, write `data-args="' + Actions.attrArgs([lcKey, '$this']) + '"'`. **After editing any inline `<script>`, run `node scripts/csp-hashes.js`**, or `test/csp.test.js` fails and production blocks the script.
- No script or stylesheet loads from another site: Bootstrap 5.3.3 and Prism 1.30.0 are self-hosted in `vendor/` (the sync token sits in localStorage, shared by every page on the origin, so the CSP in `vercel.json` allows scripts from `'self'` only). `test/security.test.js` checks this. Add a new library under `vendor/`, never as a CDN link.

## Data and sync

- All state is in localStorage. The keys that sync are listed in `BACKUP_KEYS` in `index.html`. If you add a new localStorage key that should survive across devices, add it there.
- `js/sync.js` is shared by `index.html`, `apps/gym-5day.html` and `apps/habits.html`. The decision order is documented above `doReconcile`; the short version: pull when only the cloud changed, push when only this device changed, and **merge** (key by key, `mergeValue`, and entry by entry against `<app>-sync-base` fingerprints, `mergeEntries`, so deletes stick) when both did. Earlier cloud copies live in the gist's revision history (no `.prev.json` any more), and local snapshots rotate through `<app>-presync`, `-2`, `-3`. Every sync ends in one health state (`ok`, `offline`, `rate`, `auth`, `error`) shown as a dot on `#dataAccountBtn`; `auth` also shows a sign-in banner, and `rate` pauses all tabs until GitHub's reset (`tracker-sync-paused-until`). Syncs take the `tracker-sync` Web Lock, so one tab syncs at a time. This is where data loss would happen, so run `node --test test/sync.test.js` after any change and add a test for any behaviour change.
- `DataSync.init` options: `autoPush` (upload shortly after each edit; works by hooking `Storage.prototype.setItem/removeItem` for the synced keys), `noiseKeys` (keys rewritten on every load, such as the streak, which don't count as edits), `maxKeys` (counter objects where a conflict keeps the larger number), `deepKeys` (`{ key: idField }`: merge that key recursively, arrays unioned by `idField`). Keep `noiseKeys` up to date if you add a key that is rewritten on page load, or a stale device will look edited and merge instead of fast-forwarding.
- `data.js` caches parsed objects in memory and writes the whole object back on save, so after sync changes localStorage the page must reload (sync does this itself on pull and merge). Don't write synced keys behind its back.
- Never commit tokens. The sync token lives only in the browser's localStorage.
- Account switch: the sync meta's `lastLogin` remembers which GitHub account the local data belongs to. When a different account syncs on this device, `guardAccount` asks first: load that account's own progress (the old progress is snapshotted and never uploaded), or merge this device's progress into it. Tests: `test/sync-account-switch.test.js`.
- Sign in with GitHub: `api/github-oauth.js` (Vercel function) prefers a GitHub App (env `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`: 8-hour `ghu_` tokens, refresh token in the HttpOnly `tracker_refresh` cookie, renewed by `sync.js` via `POST ?action=refresh`) and falls back to the OAuth App (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, `gho_`, no expiry). Tests: `test/expiring-token.test.js`. It returns the token in the `#tracker-signin=` fragment (plus `&expires_in=`), which `sync.js` reads and wipes on load. Tests: `test/github-signin.test.js`. `sw.js` must never cache `/api/`.
- Sign-out (`DataSync.account`) cancels a `gho_` or `ghu_` token (and drops the refresh cookie) through `POST /api/github-oauth?action=revoke` and offers to erase this browser (`localStorage.clear()`). `dsa/privacy.html` (sidebar 🔒 Privacy & data) explains what is stored and runs `DataSync.deleteMyData`. Saves in `data.js` go through `_store`, which frees the old sync snapshots and warns once when storage is full. Tests: `test/security-launch.test.js`.
- CI: `.github/workflows/tests.yml` runs the whole suite on every PR.

## Deploy

Vercel serves the repo root as-is, and a push redeploys. `vercel.json` sets a strict Content-Security-Policy: any new external script, style, font or API host has to be added there or it will be blocked in production.

The service worker (`sw.js`) caches an app-shell list in `ASSETS`. If you add a new file the main app needs offline, add it there.

## Conventions

- Commits have mostly been bare version bumps (`v219`). Descriptive messages are preferred for real changes.
- Every PR bumps the version in the sidebar footer (`vNNN · Interview Prep Hub` in `index.html`) to its commit's `vNNN`; pick the next number after the newest `vNNN` in `git log origin/main`. `test/footer-version.test.js` fails if the footer is older than any `vNNN` commit, so other PRs' versions can't leave the live site showing an old number.
- Comments explain why, not what. Match the surrounding style (the inline script uses no semicolons, `data.js` is mixed).
- No new implicit state: model a mode as one status value with named states, or derive it from the source of truth. Any change to sync or merge needs a test that fails before the change.
