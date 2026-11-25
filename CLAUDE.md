# CLAUDE.md

Static site (no build, no package.json). The main app is `index.html` (DSA Notebook). See `README.md` for the layout and how to run it.

## Run and test

- Serve the repo root: `python3 -m http.server 8000`
- Tests: `node --test test/*.test.js`. All of them should pass before you push.

## How the code is organised

- **App logic is one big inline `<script>` in `index.html`.** Data and localStorage helpers are in `js/data.js`. `data.js` holds data and data-access helpers only, with no rendering or DOM code; that includes the per-question practice records (solve counts, last practiced, cooldown ladder, streak), built on its `_jsonMap` helper. `js/dates.js` (`LocalDate.key`, `LocalDate.addDays`) is the one local-date helper for all three apps: never use `toISOString().slice(0, 10)` for a day.
- Tests load the app by taking the **largest inline `<script>` block** from `index.html` (`test/load-app.js`), after the `js/` files listed in `PAGE_SCRIPTS` there. Don't split the inline script into several large blocks, and don't add a bigger inline block, without updating that loader.
- Top-level `let`/`const` in the inline script are not reachable as globals from the tests. Use `evalIn` in `test/load-app.js`.
- Adding a topic: add it to `TOPICS` and `TOPIC_MODULES` in `js/data.js` (the module schema is documented in that file), and add a cheatsheet in `dsa/`.
- `escHtml()` should wrap any user or data text put into `innerHTML`.
- No script or stylesheet loads from another site: Bootstrap 5.3.3 and Prism 1.29.0 are self-hosted in `vendor/` (the sync token sits in localStorage, shared by every page on the origin, so the CSP in `vercel.json` allows scripts from `'self'` only). `test/security.test.js` checks this. Add a new library under `vendor/`, never as a CDN link.

## Data and sync

- All state is in localStorage. The keys that sync are listed in `BACKUP_KEYS` in `index.html`. If you add a new localStorage key that should survive across devices, add it there.
- `js/sync.js` is shared by `index.html`, `apps/gym-5day.html` and `apps/habits.html`. The decision order is documented above `doReconcile`; the short version: pull when only the cloud changed, push when only this device changed, and **merge** (key by key, `mergeValue`) when both did. The previous cloud copy is kept as `<app>.prev.json` and local snapshots rotate through `<app>-presync`, `-2`, `-3`. This is where data loss would happen, so run `node --test test/sync.test.js` after any change and add a test for any behaviour change.
- `DataSync.init` options: `autoPush` (upload shortly after each edit; works by hooking `Storage.prototype.setItem/removeItem` for the synced keys), `noiseKeys` (keys rewritten on every load, such as the streak, which don't count as edits), `maxKeys` (counter objects where a conflict keeps the larger number), `deepKeys` (`{ key: idField }`: merge that key recursively, arrays unioned by `idField`). Keep `noiseKeys` up to date if you add a key that is rewritten on page load, or a stale device will look edited and merge instead of fast-forwarding.
- `data.js` caches parsed objects in memory and writes the whole object back on save, so after sync changes localStorage the page must reload (sync does this itself on pull and merge). Don't write synced keys behind its back.
- Never commit tokens. The sync token lives only in the browser's localStorage.
- Account switch: the sync meta's `lastLogin` remembers which GitHub account the local data belongs to. When a different account syncs on this device, `guardAccount` asks first: load that account's own progress (the old progress is snapshotted and never uploaded), or merge this device's progress into it. Tests: `test/sync-account-switch.test.js`.
- Sign in with GitHub: `api/github-oauth.js` (Vercel function; env `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`) returns the token in the `#tracker-signin=` fragment, which `sync.js` reads and wipes on load. Tests: `test/github-signin.test.js`. `sw.js` must never cache `/api/`.
- Sign-out (`DataSync.account`) cancels a `gho_` token through `POST /api/github-oauth?action=revoke` and offers to erase this browser (`localStorage.clear()`). `dsa/privacy.html` (sidebar 🔒 Privacy & data) explains what is stored and runs `DataSync.deleteMyData`. Saves in `data.js` go through `_store`, which frees the old sync snapshots and warns once when storage is full. Tests: `test/security-launch.test.js`.
- CI: `.github/workflows/tests.yml` runs the whole suite on every PR.

## Deploy

Vercel serves the repo root as-is, and a push redeploys. `vercel.json` sets a strict Content-Security-Policy: any new external script, style, font or API host has to be added there or it will be blocked in production.

The service worker (`sw.js`) caches an app-shell list in `ASSETS`. If you add a new file the main app needs offline, add it there.

## Conventions

- Commits have mostly been bare version bumps (`v219`). Descriptive messages are preferred for real changes.
- Comments explain why, not what. Match the surrounding style (the inline script uses no semicolons, `data.js` is mixed).
- No new implicit state: model a mode as one status value with named states, or derive it from the source of truth. Any change to sync or merge needs a test that fails before the change.
