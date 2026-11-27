# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: open the repository's **Security** tab and choose
**Report a vulnerability** ([direct link](https://github.com/cacti23/tracker/security/advisories/new)).
You will get a reply within a few days.

## What is in scope

- The site at https://tracker-roan-nine.vercel.app/ and the code in this repository.
- `api/github-oauth.js` (Sign in with GitHub) and `js/sync.js` (sync to your private gist).

## How your data is handled

The app has no database and collects nothing. Progress stays in your browser's localStorage.
If you sign in with GitHub, it syncs to a private gist in **your own** account, using a token
that can only read and write gists. See `dsa/privacy.html` in the app (🔒 Privacy).
