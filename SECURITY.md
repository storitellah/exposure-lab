# Security Policy — Tatu Exposure Lab

## Security assumptions

- The app is a **fully static, client-side PWA**: no backend, no accounts, no
  server-side state, no secrets. There are no API keys in the frontend because
  there are no APIs.
- All persistent data (photographs, preferences, progress) lives in the
  browser's IndexedDB/localStorage on the user's device.
- The only network traffic is fetching the app's own same-origin assets.

## Data flow

```
user input ──▶ sanitisation (engine/sanitize.ts) ──▶ React state
scene render ─▶ canvas ─▶ JPEG blob ─▶ IndexedDB (local only)
                            └──▶ download / print (local only)
challenge link ─▶ allowlist parser ─▶ scene + settings (no personal data)
```

Nothing is ever uploaded. Exports are canvas re-encodes, which contain **no
EXIF/GPS metadata** by construction.

## Camera permissions

- Camera access exists only in the optional "Connect a camera" page, requested
  **only after a direct button press**, over secure contexts only.
- Microphone is never requested (`audio: false` and disabled via
  Permissions-Policy). Streams are stopped when leaving the page.
- The app is fully functional when permission is denied or unavailable.

## Local storage

- IndexedDB `tatu-exposure-lab` stores shot blobs + settings.
- localStorage stores preferences/progress/language (small JSON, parsed
  defensively; corrupted values fall back to defaults).
- A "Clear all local data" control (Gallery and Privacy pages) wipes both.

## File-upload handling

Uploads (optional photo preview) are validated by:
1. size cap (25 MB) and MIME-type accept list;
2. **magic-byte signature check** (JPEG/PNG/WebP) — extensions are not trusted;
3. safe decode via `createImageBitmap` before display — malformed files are
   rejected with a friendly error;
4. object URLs are revoked after use.

## Output/rendering safety

- User text is rendered exclusively through React text nodes (`textContent`
  semantics) and additionally sanitised (control chars/angle brackets
  stripped, length caps).
- Challenge URLs are parsed against strict allowlists (known ids, numeric
  ranges, max 512 chars) and rejected wholesale on any anomaly.
- No `eval`, no `Function` constructor, no dynamic script injection,
  no `dangerouslySetInnerHTML`.

## Security headers (Cloudflare Pages `public/_headers`)

- `Content-Security-Policy`: same-origin defaults; `blob:`/`data:` allowed
  only for images (local capture/QR/export) and `blob:` for the camera
  preview; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`.
- `Permissions-Policy`: `camera=(self)`; microphone, geolocation, payment,
  USB and sensors disabled.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`.

## Service worker

Versioned cache, same-origin GET only, successful responses only, obsolete
caches deleted on activate, no caching of blob/data URLs or private exports,
network-first navigations with an offline shell fallback, and an update
notification with a reload button.

## Dependency auditing

`npm audit` runs in development; the dependency surface is deliberately tiny
(React, Vite toolchain, one zero-dependency QR encoder, self-hosted fonts).
Resolve any critical/high advisories before deploying.

## Reporting a vulnerability

Open an issue labelled `security` in the repository (or contact the
Storitellah team privately for sensitive reports). Please include
reproduction steps and affected browser/OS. You should receive a response
within 7 days.
