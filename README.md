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
npm run test:e2e   # browser tests (Playwright; needs a Chromium install)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

No environment variables are required for the core application.

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

### Custom domain

Pages project → **Custom domains** → add your domain (e.g.
`lab.storitellah.com`). Cloudflare provisions the certificate; the
`Strict-Transport-Security` header in `_headers` is then active. The site is
portable to any static host (Netlify, GitHub Pages, S3+CDN) — copy `dist/`
and replicate the headers from `public/_headers`.

## Updating content

### Camera data

Edit `src/data/cameras.json` (or replace it wholesale via a JSON/CSV export
from a spreadsheet — keep the same field names, one object per body). Bump
`catalogueVersion` and `updated`. No interface code changes are needed;
`src/data/catalogue.ts` types and serves whatever the JSON contains.

### Lens data

Same procedure with `src/data/lenses.json`. New mounts only need an adapter
entry in `ADAPTERS` (`src/data/catalogue.ts`) if cross-mount use is expected.

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

## Documentation

- [SECURITY.md](SECURITY.md) — threat model, headers, upload handling, reporting
- [PRIVACY.md](PRIVACY.md) — privacy-first defaults, data flows
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — WCAG 2.2 AA conformance notes
- [ASSET-LICENCES.md](ASSET-LICENCES.md) — fonts, artwork, dependency licences

## Licence

Application code © Storitellah. Educational use encouraged; see repository
owner for licensing questions.
