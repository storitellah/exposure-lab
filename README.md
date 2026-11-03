# Tatu Exposure Lab by Storitellah

**Three controls. One creative decision.**

An interactive exposure triangle simulator for young photographers, photography
students, teachers, beginners and visual storytellers. *Tatu* means **three**:
photography exposure is controlled by three connected settings — **aperture**,
**shutter speed** and **ISO** — and this app teaches how they work independently
and together, for both photo and video.

- Installable Progressive Web App (works offline after first visit)
- No accounts, no uploads, no tracking — everything stays on the device
- English + Kiswahili, switchable without reload
- Guided lessons, free simulator, challenges, video exposure mode,
  local gallery, print studio, teacher mode

> Tatu Exposure Lab is an independent educational tool. It is not sponsored by
> or affiliated with any camera or lens manufacturer named in the app. Names
> appear only as searchable text labels for educational identification, and
> simulated results are educational approximations of real cameras.

## Stack

React 18 · TypeScript (strict) · Vite 5 · Canvas 2D · IndexedDB ·
hand-written service worker · Vitest · Playwright. Dependencies are pinned and
self-hosted — no third-party CDNs at runtime.

## Getting started

```bash
npm install        # install dependencies
npm run dev        # local dev server on http://localhost:5173
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright, Chromium desktop + mobile)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # production build into dist/ (includes per-route metadata)
npm run preview    # serve the production build locally
npm run icons      # regenerate PWA icons from code
npm run import:catalogue -- cameras file.csv   # update the camera catalogue
```

No environment variables are required for the core application. One optional
variable improves search-engine metadata:

```bash
SITE_URL=https://lab.example.org npm run build   # also emits sitemap.xml + robots.txt
```

Cross-browser runs are opt-in because they need extra browser downloads:

```bash
npx playwright install firefox webkit
CROSS_BROWSER=1 npx playwright test
```

If the environment already ships a Chromium build (CI images, sandboxes),
point the browser tests and `verify:dist` at it instead of downloading one:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npx playwright test
```

## Deployment — Cloudflare Pages

### Via GitHub (recommended)

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, select the repository.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - No environment variables needed.
4. Deploy. `public/_headers` (security headers) and `public/_redirects`
   (SPA fallback) are picked up automatically.

### Manual deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name tatu-exposure-lab
```

### Troubleshooting a blank / white page

A white page almost always means the browser could not load `/assets/index-<hash>.js`.
Open devtools → Console. The tell-tale error is:

> Failed to load module script: Expected a JavaScript-or-Wasm module script but
> the server responded with a MIME type of "text/html"

That means the request for the JavaScript bundle was answered with `index.html`.
There are two causes, and both are now guarded against:

1. **The SPA catch-all shadowed the built assets.** `public/_redirects` lists
   passthrough rules for `/assets/*`, `/icons/*`, `/sw.js`, the manifest,
   `robots.txt` and `sitemap.xml` **above** the `/* → /index.html` catch-all,
   so the catch-all can never swallow a real file — on any host, whatever
   order it evaluates rules in.
2. **The build output directory is wrong.** If Pages serves the repository
   root instead of `dist/`, visitors get the *source* `index.html`, which
   points at `/src/main.tsx` — a file that only exists during development.
   Confirm in the Pages project settings:
   - Build command: `npm run build`
   - **Build output directory: `dist`**
   - Root directory: the repository root (blank)

Check both before deploying with:

```bash
npm run build && npm run verify:dist
```

`verify:dist` serves `dist/` the way a static host does — applying the real
`_headers` (so the strict CSP is actually in force) and the `_redirects` rules
— then loads six routes in a browser and fails if the app does not mount or if
any rule could rewrite a built asset to HTML. `npm run preview` applies neither
file, which is exactly how a routing or header problem can pass every other
test and still ship a blank page.

If the app still cannot start, it now says so on screen instead of rendering
white: `index.html` ships static fallback content that React replaces on
mount, and a failure while mounting is caught and reported as readable text.

Two other deployment notes:

- **Do not set `NODE_ENV=production`** in the Pages environment variables.
  npm then skips devDependencies, and the build needs Vite and TypeScript.
- Bump `VERSION` in `public/sw.js` on each release so returning visitors are
  offered the update rather than being served an old cached shell.

### Custom domain

Pages project → **Custom domains** → add your domain (e.g.
`lab.storitellah.com`). Cloudflare provisions the certificate; the
`Strict-Transport-Security` header in `_headers` is then active. The site is
portable to any static host (Netlify, GitHub Pages, S3+CDN) — copy `dist/`
and replicate the headers from `public/_headers`.

## Updating content

### Camera and lens data

Catalogues are versioned JSON (`src/data/cameras.json`, `src/data/lenses.json`)
and are never hard-coded into components, so they can be updated on their own.

Either edit the JSON directly, or import a spreadsheet export:

```bash
# Replace the catalogue with the rows in a CSV
npm run import:catalogue -- cameras new-cameras.csv

# Add to / update the existing catalogue, matching on the `id` column
npm run import:catalogue -- lenses new-lenses.csv --merge

# JSON works too (an array, or an object with a "cameras"/"lenses" array)
npm run import:catalogue -- cameras new-cameras.json
```

The importer validates required fields, coerces numbers, booleans and
`;`-separated lists, understands `noise.cleanIso` / `noise.strength` columns,
rejects duplicate ids, and bumps `catalogueVersion` and `updated` for you.

Two optional fields are worth knowing about:

- A camera's `kitLensId` names the lens it ships with. That lens is marked
  "kit lens" in the picker and is chosen automatically when you switch to a
  body whose current lens does not fit — e.g. the Canon EOS R100 comes with
  the RF-S 18-45mm F4.5-6.3 IS STM.
- A lens's `maxApertureTele` is its widest aperture at the long end of the
  zoom. Set it on kit zooms and the simulator models the aperture narrowing
  as you zoom in (f/4.5 at 18mm but only f/6.3 at 45mm), closing the aperture
  by itself and explaining why — the behaviour that confuses most beginners
  with their first lens. Leave it out for primes and constant-aperture zooms. If
anything fails validation it exits non-zero and leaves the catalogue
untouched. New mounts only need an entry in `ADAPTERS`
(`src/data/catalogue.ts`) if cross-mount use should be possible.

### Scenes

Add a `SceneDef` to `src/scenes/scenes.ts`: give it an id, bilingual name,
light level (`ev100`), subject distance/speed, and layers composed from the
drawing primitives in `src/scenes/primitives.ts`. Layers are ordered
back-to-front; each declares its distance (for depth-of-field blur), speed
(for motion blur/trails) and whether it emits light.

### Lessons & challenges

`src/data/lessons.ts` and `src/data/challenges.ts` — bilingual content plus a
declarative goal/check. Scoring logic lives in `src/engine/scoring.ts`.

### Branding

Colours are CSS custom properties in `src/styles/global.css` (`:root`). The
wordmark/symbol is `src/components/Wordmark.tsx` and `public/icons/*`;
regenerate PNG icons with `node scripts/generate-icons.mjs`.

### PWA cache updates

Bump `VERSION` in `public/sw.js` (and `APP_VERSION` in `src/version.ts`)
when shipping. The service worker installs the new cache, deletes old ones on
activate, and the app shows a "new version ready" reload prompt — users are
never trapped on a stale build. To force-clear during development:
DevTools → Application → Storage → Clear site data.

## Project structure

```
public/            static assets: _headers, _redirects, sw.js, manifest, icons
scripts/           icon generator (pure Node, no image deps)
src/
  engine/          pure simulation maths (exposure, optics, video, noise,
                   scoring, sanitisation, print sizes) — fully unit-tested
  data/            versioned camera/lens catalogues (JSON) + compatibility
                   engine, lessons, challenges
  scenes/          original procedural scene illustrations + renderer
  components/      reusable UI (simulator, controls, meter, histogram…)
  pages/           one file per route
  i18n/            en/sw translation files + provider
  state/           store (React reducer) + IndexedDB/localStorage persistence
  styles/          global tokens/layout + print CSS
e2e/               Playwright browser tests
```

## Test results

| Suite | Result |
|---|---|
| `npm test` (Vitest, 58 tests) | ✅ all pass |
| `npx playwright test` (50 tests, desktop + mobile projects) | ✅ all pass |
| `npm run typecheck` (strict TS) | ✅ clean |
| `npm run lint` (ESLint + react-hooks/compiler rules) | ✅ 0 errors, 0 warnings |
| `npm audit` | ✅ 0 vulnerabilities |
| `npm run build` | ✅ ~66 kB gzipped entry chunk |

### Lighthouse

Measured against the production build (`npm run build && npm run preview`),
Chromium headless. Mobile is Lighthouse's default throttled profile.

| Page | Profile | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| `/simulator` | desktop | **100** | **100** | **100** | **100** |
| `/` | mobile | **100** | **100** | **100** | **100** |
| `/simulator` | mobile | **97** | **100** | **100** | **100** |
| `/learn` | mobile | **99** | **100** | **100** | **100** |

All above the targets (Performance 90, Accessibility 95, Best Practices 95,
SEO 90). On the mobile profile the simulator reports LCP 2.5 s, TBT 50 ms and
CLS 0.

Scores are environment-sensitive; re-run with
`CHROME_PATH=<chromium> npx lighthouse http://localhost:4173/simulator`.

Unit tests cover the exposure equation and stop arithmetic, aperture/shutter/ISO
changes, depth of field, crop factor, field of view, shutter angle, auto-exposure
solving, noise, lens/body compatibility, challenge scoring, challenge-URL parsing,
input sanitisation and print dimensions — plus content invariants: every scene
opens within ⅓ stop of a correct exposure, and every lesson is neither
pre-solved nor unsolvable at its starting point.

Browser tests cover taking, keeping, deleting, downloading and printing a
photograph; changing body and lens (including rejecting an incompatible lens
and explaining an adapter); completing a lesson; opening and validating
challenge links; scoring a challenge; keyboard control; camera-permission
denial; language switching; clearing local data; the 180° shutter-angle rule;
and no horizontal scrolling at all nine required viewport sizes plus landscape.

## Deployment checklist

1. `npm ci` — install exactly the pinned dependency tree.
2. `npm run lint && npm run typecheck && npm test` — all must pass.
3. `npx playwright test` — 50 browser tests; add `CROSS_BROWSER=1` after
   installing Firefox/WebKit if you want those engines too.
4. `npm audit` — expect 0 vulnerabilities.
5. `SITE_URL=https://your-domain npm run build` — production build with
   per-route metadata, `sitemap.xml` and `robots.txt`.
6. `npm run verify:dist` — serves the build with the real `_headers` and
   `_redirects` and fails if the app does not mount or if a routing rule
   could rewrite a built asset to HTML (the blank-page failure mode).
7. Deploy (build command `npm run build`, output directory `dist`).
8. After deploy, verify:
   - security headers are present (browser devtools → Network → response headers);
   - the app installs as a PWA and still works with the network disabled;
   - the shutter button takes a photograph and the gallery persists it;
   - a challenge link opens the right scene, and a malformed one is rejected;
   - camera permission is only requested by the "Use My Camera" button.
9. Bump `VERSION` in `public/sw.js` and `APP_VERSION` in `src/version.ts` for
   the next release so returning users get the update prompt.

## Known browser limitations

- **Verified in Chromium** (desktop and mobile emulation) for rendering,
  interaction and Lighthouse. Firefox and WebKit/Safari are supported through
  feature detection but were not executed here — the browser downloads are
  blocked in this build environment. Run `CROSS_BROWSER=1 npx playwright test`
  locally to exercise them.
- **`ctx.filter`** (canvas blur) is unavailable in a few older engines. The
  renderer detects this and falls back to a downscale/upscale blur, so depth
  of field still reads correctly, with slightly softer bokeh edges.
- **Safari/iOS**: `beforeinstallprompt` does not exist, so the in-app
  "Install app" button is hidden — installing is done through Share → Add to
  Home Screen. `navigator.share` is used where present.
- **Device camera** exposes no real aperture/shutter/ISO control to web pages
  on any browser, so "Use My Camera" clearly labels its exposure preview as
  simulated rather than pretending to drive the hardware.
- **`navigator.vibrate`** is ignored on iOS; capture haptics are silently
  skipped there.
- **Private browsing** can block IndexedDB. Saving a photograph then reports
  a friendly storage error and the rest of the app keeps working.
- **OffscreenCanvas / Web Workers** are not used: after caching blurred
  layers and coalescing renders into animation frames, total blocking time is
  ~50 ms, so moving work off the main thread would add complexity without a
  measurable benefit.

## Documentation

- [SECURITY.md](SECURITY.md) — threat model, headers, upload handling, reporting
- [PRIVACY.md](PRIVACY.md) — privacy-first defaults, data flows
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — WCAG 2.2 AA conformance notes
- [ASSET-LICENCES.md](ASSET-LICENCES.md) — fonts, artwork, dependency licences

## Licence

Application code © Storitellah. Educational use encouraged; see repository
owner for licensing questions.
