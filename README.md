# Tracker

Personal tracker for DSA interview prep, plus a few small side apps. It's a plain static site with no build step, deployed on Vercel at https://tracker-roan-nine.vercel.app/. Every push to the connected branch redeploys it.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **Interview Prep Hub**, the main app (the DSA notebook). Dashboard, 16 topics, 600+ questions, practice sessions (Worked / Graded / Mock), spaced-repetition revision, daily question, streaks, notes, pins, search. |
| `js/data.js` | Topic and question data, plus the localStorage helpers for progress, notes and revision state. |
| `js/sync.js` | Cross-device sync through a private GitHub gist. Shared by every app. |
| `js/back-button.js` | Floating "← Tracker" pill on every standalone page (`dsa/`, `apps/`, `google/`, `visuals/`, `sysdesign/`). |
| `dsa/*.html` | One cheatsheet per topic, plus the thoughts, JS built-ins and study sites pages. |
| `google/*.html` | Google prep hub and the onsite log (interview sources are an accordion at its top). They're shown inside the main app's Google view. |
| `visuals/visuals.html` | Image cheat sheets (inline SVG cards, one picture per idea). Shown inside the main app's Visuals view. |
| `sysdesign/system-design.html` | System design notes, one card per topic. Linked from the sidebar bottom. |
| `apps/gym-5day.html` | 5-day PPL workout tracker. |
| `apps/habits.html` | Habits tracker (its own PWA: `habits-manifest.json`, `habits-sw.js`). |
| `docs/` | Prompts and personal notes (`docs/notes`). |
| `sw.js`, `manifest.json` | Service worker and manifest for the main PWA (works offline). |
| `test/` | Node tests. |
| `vercel.json` | Security headers, including the Content-Security-Policy. |

All state lives in the browser's localStorage. Nothing is stored on a server.

## Run it locally

No install step. Serve the repo root with any static server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening the file directly (`file://`) won't work properly because of the service worker and the page loading other files.

## Tests

```sh
node --test test/*.test.js
```

The tests load `js/data.js` and the inline script from `index.html` into a Node `vm` with a fake localStorage, so they check state logic (grading, sync, security rules, link integrity), not how things look in a real browser.

## Cloud sync

Tap **Sign in with GitHub** once per device. There are no Sync, Pull, Token, Export or Import buttons: every app checks the cloud when it opens and when you come back to the tab, and uploads a few seconds after each edit. Data is synced to one private gist called `tracker-sync-v1`, one JSON file per app. The token is stored only in that browser's localStorage.

Sign in with GitHub runs through `api/github-oauth.js`, a Vercel serverless function that swaps GitHub's one-time code for a token (the client secret must stay off the browser) and hands it back in the URL fragment. It stores nothing server-side. Preferred setup: a **GitHub App** (Settings → Developer settings → GitHub Apps) with Account permissions → Gists: Read and write, callback URL `https://<your-site>/api/github-oauth`, "Expire user authorization tokens" on and the webhook off; add `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` to Vercel and redeploy. Its tokens last 8 hours; the refresh token lives in an HttpOnly cookie only the function can read, and `sync.js` renews through `POST /api/github-oauth?action=refresh`. Without those keys, the older OAuth App setup (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, never-expiring `gist`-scope tokens) is used; keep its keys until every device has signed in again, since sign-out needs them to cancel old tokens.

- The DSA notebook and the gym app upload a few seconds after every edit. The habits app syncs after its own edits.
- If two devices both changed things, the data is merged entry by entry rather than one device overwriting the other. If both changed the same entry, the most recently edited side wins.
- Safety nets: every upload is a new gist revision, so earlier cloud copies stay in the gist's revision history, and each device keeps its last three pre-sync snapshots in localStorage (`<app>-presync`, `-presync-2`, `-presync-3`).
- Known limit: there are no per-entry timestamps, so deleting something on one device can be undone by another device that still has it.

## Deploying

Pushing to the branch Vercel watches deploys automatically. Pull requests get a Vercel preview URL if the Vercel GitHub integration is on for this repo. The service worker serves HTML and JS network-first, so a new deploy shows up on the next load.
