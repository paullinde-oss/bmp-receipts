# BMP Receipt Tracker

Staff receipt capture PWA for BMP Supplies. Users photograph a receipt, Claude
scans it, the data lands in Firestore and the image in Firebase Storage.

- Live: https://paullinde-oss.github.io/bmp-receipts/
- Repo: paullinde-oss/bmp-receipts
- Current version: v2.2

## Development

Source is a Vite + React app in `src/`. Edit readable JSX, never the built output.

```bash
npm install
npm run dev       # local dev server at http://localhost:5173/bmp-receipts/
npm run build     # production build into dist/
npm run format    # prettier
```

**Careful: `npm run dev` talks to the real production Firebase project.**
Anything you save, edit or delete locally changes live data.

Deploys happen automatically: `.github/workflows/deploy.yml` builds on every push
to `main` and publishes `dist/` to GitHub Pages (Settings → Pages → Source must be
"GitHub Actions"). Pull requests run the build too, so a syntax error fails CI
instead of blanking the live site.

`legacy/index.html` is the last hand-patched minified bundle (v2.2), kept for
reference while the rebuilt source settles in. It is not deployed. Delete it once
the source tree has been trusted in production for a while.

## Stack

- React 18.3.1, built with Vite
- Firebase 10.14.1: Firestore + Storage (no Firebase Auth)
- Anthropic API called directly from the browser for receipt OCR (`src/lib/scanReceipt.js`)
- Deployed to GitHub Pages via GitHub Actions

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
in the source (`src/lib/constants.js`, `src/components/Settings.jsx`); they are
deliberately not written here in plain text.

Known weakness (pre-existing): the login check in `src/components/Login.jsx`
only rejects the default password if the device's cached config says the user
has their own password. On a device with no cached config, the default password
signs in as anyone. All of this is client-side and readable by anyone who opens
the page, so treat it as a convenience lock, not security.

## Source layout

| File | Role | Old bundle symbol |
| --- | --- | --- |
| `src/main.jsx` | Entry: PWA bootstrap, styles, mounts `<App>` | — |
| `src/App.jsx` | Session (user/admin/theme), tabs, FAB + hidden file inputs, toasts | `RR` |
| `src/components/Login.jsx` | Name picker + password screen | `kR` |
| `src/components/Header.jsx` | Header | `CR` |
| `src/components/Capture.jsx` | Capture / AI scan / save screen | `PR` |
| `src/components/ReceiptFields.jsx` | Editable receipt fields form | `R0` |
| `src/components/ZoomableImage.jsx` | Pinch/wheel-zoom receipt preview | `BR` |
| `src/components/ReceiptList.jsx` | Receipt list + detail modal + move-to-folder modal | `Gi` |
| `src/components/Home.jsx` | Folder grid, folder add/delete modals, recent list | `NR` |
| `src/components/AdminView.jsx` | Admin "all team receipts", CSV export, date filters | `DR` |
| `src/components/Settings.jsx` | Settings (user + admin sections) | `VR` |
| `src/lib/config.js` | Load/cache/save `appConfig/settings`, scan usage counter | `tr`, `br` |
| `src/lib/constants.js` | Version, default users/folders, folder emoji | `of`, `Tl`, `pr` |
| `src/lib/firebase.js` | Firebase init (`db`, `storage`) | — |
| `src/lib/images.js` | PDF→JPEG, format conversion, compression | — |
| `src/lib/scanReceipt.js` | Claude receipt-scan call and prompt | — |
| `src/hooks/useToast.js` | Toast queue | — |
| `src/pwa.js` | Service worker registration + install button (injected into Settings) | — |
| `src/styles.css` | All app styles | — |
| `public/` | Copied as-is: `manifest.json`, `sw.js`, icons, splash images, favicon | — |

The source was recovered from the minified bundle mechanically (un-minified,
split into modules, then variables renamed with a scope-aware tool). It was
checked against the original by running both versions side by side on the same
fake in-memory Firebase and comparing the rendered page after every step of
automated click-throughs. Behaviour should be identical to the old bundle,
quirks included.

## Behaviour worth preserving

- **Custom folders live in localStorage per device**, keyed `bmp_folders_<user>`.
  Because of that, a folder created on one device used to vanish on another.
  `Home.jsx` auto-discovers folder names off the receipts loaded from Firestore and
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

1. **Forgot-password via EmailJS is not in this repo.** Earlier notes describe an
   EmailJS forgot-password flow in the login screen (placeholders
   `service_bmpreceipts`, `template_pwreset`, `YOUR_EMAILJS_PUBLIC_KEY`; template
   uses `{{to_email}}`, `{{user_name}}`, `{{user_password}}`; only
   `@bmpsupplies.com` addresses allowed). The bundle committed here (June 18)
   doesn't contain it, so it was either never uploaded or lost. Re-implement it in
   `src/components/Login.jsx` if still wanted.
2. **PWA install prompt isn't firing on Android.** `manifest.json`, `sw.js`, and
   the icons are in `public/`, but Chrome still won't offer "Install app". Worth
   debugging in DevTools → Application → Manifest.
3. Splash screen: the splash images are preloaded and `.splash-screen` CSS exists,
   but no component renders a splash in this version.
4. Security (larger change): Firestore/Storage rules are wide open, and the
   Anthropic key and every user's password sit in `appConfig/settings`, readable
   by anyone. Moving the Claude call behind a server-side function would fix the
   key exposure.

## Working agreement

- Describe the approach and get sign-off before making layout or UI changes.
- Explain root causes, not symptom patches.
- `npm run build` must pass before pushing; CI enforces it on pull requests.
