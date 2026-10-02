# Tracker

Personal tracker for DSA interview prep, plus a few small side apps. It's a plain static site with no build step, deployed on Vercel at https://tracker-roan-nine.vercel.app/. Every push to the connected branch redeploys it.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **DSA Notebook**, the main app. Dashboard, 16 topics, 600+ questions, practice sessions (Worked / Graded / Mock), spaced-repetition revision, daily question, streaks, notes, pins, search. |
| `js/data.js` | Topic and question data, plus the localStorage helpers for progress, notes and revision state. |
| `js/sync.js` | Cross-device sync through a private GitHub gist. Shared by every app. |
| `js/back-button.js` | Floating "← Tracker" pill on every standalone page (`dsa/`, `apps/`, `google/`). |
| `dsa/*.html` | One cheatsheet per topic, plus the master map, thoughts and JS built-ins pages. |
| `google/*.html` | Google prep hub, interview sources and onsite log. They're shown inside the main app's Google view. |
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

Paste a GitHub token once per device (a fine-grained token with only the **Gists** permission, or a classic token with the `gist` scope). Data is synced to one private gist called `tracker-sync-v1`, one JSON file per app. The token is stored only in that browser's localStorage.

## Deploying

Pushing to the branch Vercel watches deploys automatically. Pull requests get a Vercel preview URL if the Vercel GitHub integration is on for this repo. The service worker serves HTML and JS network-first, so a new deploy shows up on the next load.
