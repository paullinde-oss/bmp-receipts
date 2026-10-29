# BMP Receipt Tracker

Staff receipt capture PWA for BMP Supplies. Users photograph a receipt, Claude
scans it, the data lands in Firestore and the image in Firebase Storage.

- Live: https://paullinde-oss.github.io/bmp-receipts/
- Repo: paullinde-oss/bmp-receipts
- Current version: v2.2

## IMPORTANT: read this before editing

The repo currently contains **only a pre-built, minified `index.html`** (~840 KB).
There is no source tree. Every edit so far has been hand-patching minified JSX
(`f.jsx("div",{...})`) with string replacement, which has caused repeated
black-screen outages from unbalanced brackets.

**First task in Claude Code should be to reconstruct a real source tree** so edits
happen in readable JSX with a build step. Until that is done, after *every* change
to the bundle, validate the syntax before deploying:

```bash
npm install     # once, installs acorn
npm run check   # prints OK, or ERR plus the surrounding code; exits non-zero on failure
```

The validator lives in `scripts/validate.js`.

## Stack

- React (bundled, no runtime build on the host)
- Firebase Firestore + Firebase Storage
- Anthropic API called directly from the browser for receipt OCR
- EmailJS (newly added, not yet configured — see below)
- Deployed to GitHub Pages by committing `index.html` to `main`

## Firebase

- Project: `bmp-receipt-tracker`
- Storage bucket: `bmp-receipt-tracker.firebasestorage.app`
- Firestore collections:
  - `receipts` — one doc per receipt (`vendor`, `date`, `total`, `folder`,
    `user`, `notes`, `storagePath`, `editedAt`, `editedBy`, `editReason`)
  - `appConfig/settings` — app config doc, including:
    - `userPasswords` — map of user name → password
    - `anthropicKey` — API key for receipt scanning
    - `scanCap` — monthly AI scan limit (currently 400)
    - `users` — user list override

Both Firestore and Storage rules are currently `allow read, write: if true`.
The app does not use Firebase Auth, so auth-based rules will not work without
a larger change. Note: Storage rules ship with a 30-day expiry date by default —
that expiry already bit us once and locked all photos out with
`storage/unauthorized`. Keep an eye on it.

## Auth model

Custom, not Firebase Auth. Flow: tap your name → enter password.
A hardcoded fallback password works for any user with no entry in
`userPasswords`, and a separate hardcoded admin unlock code exists. Both are
in the bundle; they are deliberately not written here because this repo is
served publicly by GitHub Pages (this file is reachable at `/CLAUDE.md`).

## Key components in the bundle

Minified names, in file order:

| Symbol | Role |
| --- | --- |
| `kR` | Login — name picker, password screen, forgot-password modal |
| `PR` | Capture / AI scan screen |
| `Gi` | Receipt list + receipt detail modal + move-to-folder modal |
| `NR` | Home screen — folder grid, folder add/delete modals, recent list |
| `DR` | Admin "all team receipts" view, CSV export, date filters |
| `VR` | Settings |
| `CR` | Header |
| `of` | Default user list |
| `Tl` | Default folders: Gas, Auto, Food/Entertainment, Misc |
| `tr()` | Loads/caches `appConfig/settings` |
| `pr()` | Folder name → emoji |

## Behaviour worth preserving

- **Custom folders live in localStorage per device**, keyed `bmp_folders_<user>`.
  Because of that, a folder created on one device used to vanish on another.
  `NR` now auto-discovers folder names off the receipts loaded from Firestore and
  merges any missing ones back into localStorage on load. Don't regress this.
- **No browser dialogs in the folder flows.** `prompt()` / `confirm()` were
  replaced with in-app bottom-sheet modals using the existing
  `modal-overlay` / `modal` / `warn-box` / `folder-btn` classes. The only
  remaining `window.confirm` is receipt delete (intentional — destructive).
  The only remaining `window.location.reload()` is the admin unlock flow.
- **Folder tiles must be direct children of `.folder-grid`.** It's a 2-col CSS
  grid; wrapping tiles in a `<div>` breaks the layout. Learned the hard way.
- Admin date filters default to the current month (1st → last day).

## Outstanding work

1. **Reconstruct source tree** (see above) — highest value.
2. **Finish EmailJS setup** for forgot-password. The code is in place in `kR` but
   has placeholders that must be replaced:
   - `service_bmpreceipts` → real EmailJS service ID
   - `template_pwreset` → real template ID
   - `YOUR_EMAILJS_PUBLIC_KEY` → real public key

   Template needs `{{to_email}}`, `{{user_name}}`, `{{user_password}}`.
   The flow validates the address ends in `@bmpsupplies.com` and rejects
   anything else.
3. **PWA install prompt isn't firing on Android.** `manifest.json`, `sw.js`, and
   `icon-192.png` / `icon-512.png` are all in the repo and referenced from
   `index.html`, but Chrome still won't offer "Install app". Worth debugging in
   DevTools → Application → Manifest.
4. Splash screen doesn't fit perfectly on mobile (long-standing, low priority).

## Working agreement

- Describe the approach and get sign-off before making layout or UI changes.
- Explain root causes, not symptom patches.
- Run the syntax validator after every change to the bundle, before deploying.

## Files in the repo

```
index.html      the entire app
CLAUDE.md       this file
package.json    dev tooling only (acorn for the syntax check)
scripts/validate.js  bundle syntax check
manifest.json   PWA manifest
sw.js           app-shell service worker
icon-192.png    PWA icon
icon-512.png    PWA icon
receipt_track_splash.png
receipt_track_splash_desktop.png
```
