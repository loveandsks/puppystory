# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A puppy growth diary web app (Korean UI) for one dog, "편백이" (a 꼬숑 puppy, born 2026-07-23). It is client-only: no server, no login, no external APIs, and every feature must work offline. The user writes in Korean, so reply and write UI text in Korean.

- `PRD.md` is the spec. Feature IDs (`F-1.1` … `F-6.6`) and acceptance criteria (`AC-1` … `AC-15`, section 9) are the reference for behavior and expected values.
- `PROMPTS.md` is the staged build plan (stages 0 → 4). All stages are done; new work comes as individual requests.
- `REVIEW.md` is the stage 4 review: the PRD checklist, the bug/risk list (R1–R16), and in section 4 which fixes were applied and what is still open. Check it before starting on a "remaining" item.
- **Stack decision overrides the PRD:** PRD §1.3 and §6 describe a vanilla single-file `index.html`. The confirmed stack is React + Vite + Tailwind CSS v4 + React Router (HashRouter) + Zustand persist. Keep the PRD's other constraints: few dependencies, SVG charts without a library, a hand-written EXIF parser, a hand-written Service Worker.

## Commands

```
npm install
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # outputs to dist/ (base: './') including the generated dist/sw.js
npm run preview    # serve the built dist/
npm run test:e2e   # all Playwright specs, projects desktop-chrome + iphone-13
npm run icons      # regenerate the PNG app icons in public/ (scripts/make-icons.mjs, uses Playwright Chromium)
npx playwright test tests/<file>.spec.js -g "<test name>"   # single test, e.g. -g "AC-6"
node -e "import('./src/utils/selfTest.js').then(m => console.log(m.runSelfTests().filter(r => !r.pass)))"   # pure-function self-test; [] means all pass
```

- There is no linter or unit-test runner. `src/utils/selfTest.js` is the unit-level check: it tests the pure functions against the PRD's expected values (D+116 / 4개월차 on 2026-11-16; 107g/day and 27g/meal for 2.4kg at 3.8kcal/g). It also runs in the app (Settings → 자가 진단) and as `console.assert` in dev mode. Add a case there when you add or change a pure function.
- `playwright.config.js` starts two servers: the dev server on 5173 (an already-running one is reused) and `npm run build && vite preview` on **4173**, which must be free. Only `tests/offline.spec.js` uses 4173, because the Service Worker exists only in builds.
- Only Chromium is installed for Playwright, so the iPhone 13 project runs on Chromium (390px + touch emulation).

E2E conventions (`tests/helpers.js`):
- Every test fails on any console error (auto fixture `consoleErrors`). A test that expects an error must assert on the array and then empty it.
- `openApp` fixes "today" at 2026-11-16 10:00, and `moveToday` changes the date and reloads. Tests that need timers to advance use `page.clock.install` + `runFor`/`fastForward` instead.
- `seed` writes partial store state before the first load. Missing keys get filled by `normalizeData`.
- `makeJpeg` builds a JPEG with an EXIF date.
- `tests/acceptance.spec.js` maps 1:1 to AC-1..AC-15. `tests/fixes.spec.js` and `tests/robustness.spec.js` cover the REVIEW.md fixes.

## Architecture

**Storage is split in two, and keeping it split is a hard rule:**
- `src/store/usePuppyStore.js`: a single Zustand store persisted to localStorage under the key `puppyDiary.v1`. It holds all text and numeric user data (schema in PRD §5.2, plus `backupInfo`).
  - `createInitialData()` defines the data keys. Defaults come from `src/data/defaults.js`.
  - `pickData` strips actions, both for persistence (`partialize`) and for backups.
  - `normalizeData` runs in `migrate`, in `merge` (on every load and on rehydrate) and in `importData`. It first runs `sanitizeData` (`src/utils/sanitize.js`), which checks the items inside each list: it fills missing optional fields and drops records that would break rendering, such as a weight without a date. It then fills missing keys with defaults and drops unknown keys.
  - **Adding a data key:** add it to `createInitialData`. If screens rely on a field inside list items, add it to the matching fixer in `sanitize.js` too. **Changing the shape of existing data:** bump `SCHEMA_VERSION` and convert old data in `migrate`.
  - Writes go through `safeLocalStorage`. A failed write (quota exceeded) or blocked localStorage sets `useUiStore.saveError`, and `components/SaveErrorBanner.jsx` shows a warning instead of throwing. The next successful write clears it.
  - A `storage` event listener rehydrates the store when another tab writes, so two open tabs don't overwrite each other.
- `src/db/imageDB.js`: an IndexedDB wrapper (DB `puppyDiaryMedia`, store `images`). Photo, receipt and symptom-log Blobs live here, and the store keeps only their ids. Never put images or base64 in the store, because localStorage caps at about 5MB.
  - Display images with `useImageUrl(id)` (or `components/ImageThumb.jsx`). It creates an object URL and revokes it on unmount, so screens don't leak object URLs. (`utils/image.js` creates and revokes its own object URLs while compressing.)
  - When a record that owns images is deleted, delete its IndexedDB images too (see `deleteReceipt`, `deletePhoto`, `deleteSymptomLog`).
  - When an upload fails partway, delete the images already saved.
  - A new image field must be added to `referencedImageIds` in `src/utils/backup.js`, or full backups will skip it and orphan cleanup will delete it.

`src/store/useUiStore.js` is a separate, non-persisted Zustand store for screen state (toasts, missed events, `saveError`). `hooks/usePuppyInfo.js` bundles values several screens derive from the store (D-Day, months elapsed, latest weight, core vaccines done), so use it instead of recomputing them.

**Backup** (`src/utils/backup.js`): JSON in the envelope `{ app: 'puppy-diary', schemaVersion, data, images? }`.
- A "full" backup adds the referenced images as data URLs.
- `parseBackup` validates the file and reports how many items `sanitizeData` dropped.
- Importing first auto-downloads a full backup of the current data.
- `downloadBackup` records `backupInfo.lastBackupDate`. `src/utils/backupReminder.js` decides when the header ⚙️ shows the 30-day reminder badge (PRD §8).

**Dates:** always store local `'YYYY-MM-DD'` strings and do arithmetic through `src/utils/date.js` (`parseLocalDate`, `toLocalDateString`, `addDays`, `diffDays`). Never use `new Date('YYYY-MM-DD')` or `toISOString().slice(0,10)`. They shift the day across time zones; in KST, records made between 00:00 and 09:00 would land on the previous day. Compare date strings lexically. Components get "today" from `useToday()`, which refreshes at midnight and when the tab regains focus.

**IDs:** use `makeId()` from `src/utils/id.js`, not `crypto.randomUUID()` directly. `randomUUID` is undefined on a non-secure origin, such as a phone testing over `http://192.168.x.x`.

**Pure logic in `src/utils`:** D-Day, feeding amounts, vaccine schedules, streaks, care due dates, triage, sanitizing and backup reminders are pure functions with no browser or store imports, so `selfTest.js` can run them in Node. Keep it that way. `backup.js`, `calendarExport.js` and `image.js` are the browser-side exceptions.
- Weight alerts are not stored. `analyzeWeights` recomputes them from the sorted weights, so editing or deleting a middle record stays correct.
- Feeding uses a "feeding day" (`getFeedingDay`): a slot earlier than `firstMealTime` (for example 01:00) belongs to the previous day's schedule.

**Routing and layout:** `HashRouter` is used so reloads and deep links work on any static host without rewrites.
- `components/Layout.jsx` contains:
  - a max-width 448px mobile column with safe-area padding
  - a sticky `AppHeader` (⚙️ settings link with the backup badge, D-Day text, SOS link to `/emergency`)
  - `SaveErrorBanner` and `NotificationCenter`
  - each route wrapped in `ErrorBoundary`, keyed by path, so a render error replaces only that screen while the nav and SOS keep working
  - a fixed `BottomNav` with 6 tabs: home, growth, diet, health, care, gallery
- `/emergency` and `/settings` are reached only from the header. Unknown routes redirect to `/`.

**Notifications** (`components/NotificationCenter.jsx`, logic in `utils/notify.js`): the app checks every 30 seconds while it is open.
- `notifications.firedKeys` (`{key: date}`) prevents re-firing. Before each check the app re-reads keys another tab just wrote, so two tabs don't both fire.
- `lastCheckedAt` bounds the "놓친 일정" (missed events) lookback. It is saved only every 5 minutes or when the page is hidden.
- Notifications cannot fire while the tab is closed. The `.ics` export (`utils/ics.js`) covers that case.

**Offline / Service Worker:** `src/sw.template.js` is the source and is never imported by the app.
- The `serviceWorker` plugin in `vite.config.js` fills in the cache version and the hashed build file list, and emits `dist/sw.js`.
- `main.jsx` registers it only in production builds over http(s). It does nothing under `npm run dev` or `file://`.
- Page loads are network-first (3s timeout) and fall back to the cached `index.html`. Other files are cache-first. Cache lookups use `ignoreVary` because `vite preview` sends `Vary` headers.
- The precache list also includes every file in `public/` (manifest, icons), except hosting config files (`_headers`, `_redirects`).

**Deployment / PWA:** `DEPLOY.md` is the user-facing guide (Netlify Drop, Cloudflare Pages, Vercel, GitHub Pages).
- `public/manifest.webmanifest` plus `public/*.png` icons make the app installable. `index.html` links them with absolute `/` paths, and Vite rewrites them to `./` because of `base: './'`.
- Cache headers: `public/_headers` (Netlify, Cloudflare), `vercel.json`, `netlify.toml` (build settings). `index.html`, `sw.js` and the manifest are `no-cache`; `assets/` is immutable. `.github/workflows/deploy-pages.yml` deploys to GitHub Pages on push to `main`.
- User data is per origin, so moving to a new URL needs export → import (Settings → 데이터 백업).
- `tests/offline.spec.js` also checks the manifest, the icons, the precache contents and Chrome's `Page.getInstallabilityErrors`.

## UI conventions

- **Colors:** use only the tokens in `src/index.css` (`cream`, `card`, `tint`, `line`, `ink`, `cocoa`, `muted`, `faint`, `peach`, `peach-strong`, `on-peach`, `ok`/`warn`/`danger` plus their `-bg` variants, and `sos`). Don't hardcode Tailwind palette colors like `stone-500` or `red-100`. The tokens are CSS variables redefined under `prefers-color-scheme: dark`, so dark mode only works through them. SVG elements use `var(--c-*)`.
- **Shared UI** lives in `components/ui.jsx`: `Card`, `Button`, `Chip`, `Field`, `Empty` (with a first-action button), `Banner`, `StatusPill` (shows color, emoji and text together), and `Modal`. Keep interactive elements at least 44px tall (`min-h-11`), and keep the 360px width free of horizontal scroll (`tests/layout.spec.js` checks this).
- **Emoji fallback:** 🪮 renders as a box on Windows, so badge icons go through `components/badgeIcon.js` when displayed. Don't change the data in `utils/grooming.js`.
- **Bottom nav** hides while a text input is focused on touch devices (the keyboard is open). `html` sets `scroll-padding-bottom` so focused inputs scroll above the nav.

## Domain constraints

- Health-related content, including emergency guide cards, warnings and feeding advice, must show the disclaimer "참고용이며 수의사 진단을 대신하지 않습니다".
- Emergency content (`src/data/emergencyGuide.js`) is a draft pending review by a veterinarian. After review, set `GUIDE_META.status` and `reviewedAt` there. Never generate automatic diagnoses; use the rule tables from PRD §4.6.
- The default food kcal values in `src/data/defaults.js` are placeholders. `isExampleKcal` flags them in the UI until the user edits or confirms them.
