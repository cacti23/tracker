# ⚡ Interview Prep Hub

A free, open-source place to prepare for software engineering interviews: DSA, system design and real interview experiences in one app.

**Live:** https://tracker-roan-nine.vercel.app/

No account, no server, no tracking. Your progress stays in your browser. Sign in with GitHub only if you want it on every device: it then syncs to a private gist in **your own** GitHub account.

## What you get

| | |
|---|---|
| 🧩 **DSA** | 610 hand-picked problems in 16 topics, each grouped by the pattern that solves it. Mark a problem solved, then grade how well you remembered it (✓ solid, ~ shaky, ✗ forgot) and it comes back on the day it is due. Dashboard, question of the day, 🕘 Recently solved, notes, pins and search. |
| 🏛️ **System Design** | Lesson notes with diagrams and step-by-step animations, an AWS map, a glossary and practice questions. Inspired by [Hello Interview's](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) system design lessons. |
| 💼 **Interview experiences** | Real Google L3/L4 interview experiences, matched to LeetCode and rebuilt in code. More companies to come. |
| 🧰 **Study tools** | DSA Thoughts, JS built-ins, DSA visuals, Paper Club, production postmortems and a list of the best study sites. |

Works offline once loaded (it is a PWA), in light and dark themes, on desktop and phone.

## Contributing

Found a bug, a wrong answer or a better resource? Contributions are welcome.

1. Open an [issue](https://github.com/cacti23/tracker/issues) to report a bug or suggest an idea, or use **💬 Send feedback** in the app.
2. For a fix, fork the repo, make the change on a branch and open a pull request.
3. Run the tests before you push (see below). CI runs them on every pull request.
4. Bump the version in the sidebar footer (`vNNN · Interview Prep Hub` in `index.html`) to the next number. A test checks it.

[`CLAUDE.md`](CLAUDE.md) has the coding conventions (it is written for AI assistants but reads fine for people too).

## Run it locally

No install and no build step. Serve the repo root with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` as a file (`file://`) won't work properly, because of the service worker and the pages it loads.

## Tests

```sh
node --test test/*.test.js
```

Most tests load `js/data.js` and the inline script from `index.html` into a Node `vm` with a fake localStorage, so they check state logic (grading, sync, security rules, link integrity). The browser tests use Playwright and are skipped when it isn't installed.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | The app: sidebar, DSA notebook, and the frame that shows the other pages. |
| `js/data.js` | Topic and question data, plus the localStorage helpers for progress, notes and revision. |
| `js/sync.js` | Optional sync through a private GitHub gist. |
| `js/actions.js` | Event handlers by `data-click` attributes (the CSP allows no inline handlers). |
| `dsa/` | Topic cheat sheets, DSA Thoughts, JS built-ins, Study Sites, How to use, Privacy. |
| `sysdesign/system-design.html` | System design notes. |
| `google/` | Google interview experience log. |
| `papers/` | Paper Club and Postmortems. |
| `visuals/visuals.html` | DSA visuals, one picture per idea. |
| `apps/` | Personal side apps (habits, gym), shown only to the owner. |
| `api/github-oauth.js` | Vercel function for Sign in with GitHub. Stores nothing. |
| `sw.js`, `manifest.json` | Service worker and manifest (offline support). |
| `test/` | Node tests. |
| `vercel.json` | Security headers, including the Content-Security-Policy. |

## Privacy

- Everything you do is saved in your browser's localStorage. There is no database and no analytics.
- Sign in with GitHub is optional. It lets the app save your progress to one private gist, `tracker-sync-v1`, in your own account. The token stays in your browser.
- 🔒 **Privacy & data** in the sidebar explains what is stored and lets you delete it.

## Self-hosting and sync setup

Fork the repo and import it into [Vercel](https://vercel.com/) (no build settings needed). The app works without sync. To turn on Sign in with GitHub:

1. Create a **GitHub App** (Settings → Developer settings → GitHub Apps) with Account permissions → Gists: Read and write, callback URL `https://<your-site>/api/github-oauth`, "Expire user authorization tokens" on and the webhook off.
2. Add `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` to the Vercel project and redeploy.

Tokens last 8 hours. The refresh token lives in an HttpOnly cookie that only the function can read, and `sync.js` renews it through `POST /api/github-oauth?action=refresh`. Without those keys, the older OAuth App setup (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `gist`-scope tokens that don't expire) is used.

How sync behaves:

- The app checks the cloud when it opens and when you come back to the tab, and uploads a few seconds after each edit.
- If two devices both changed things, the data is merged entry by entry instead of one device overwriting the other.
- Every upload is a new gist revision, so earlier copies stay in the gist's history, and each device keeps its last three pre-sync snapshots.

Pushing to the branch Vercel watches deploys automatically. The service worker loads HTML and JS from the network first, so a new deploy shows up on the next load.
