# Privacy — Tatu Exposure Lab

**The short version: your photographs and progress never leave your device.**

## Privacy-first defaults

- No account, registration, or payment is required — ever.
- No photographs are uploaded; there is no server to upload to.
- No facial recognition, no location tracking, no fingerprinting.
- No advertising trackers, no analytics beacons, no third-party requests.
- No contact-list access; the microphone is never requested.
- No cookies are set by the application.
- We do not collect names, ages, school information, precise locations or
  contact details. The optional "photographer name" on prints is stored only
  on the device and printed only when the user chooses.

## What is stored, and where

| Data | Where | Why |
|---|---|---|
| Captured simulated photographs | IndexedDB (device) | Local gallery |
| Preferences (theme, language, sound…) | localStorage (device) | Remember settings |
| Lesson progress, badges, best scores, streaks | localStorage (device) | Learning progress |

All of it can be removed with **"Clear all local data"** (Gallery or Privacy
page), or by clearing the browser's site data.

## Sharing

Challenge links contain only: challenge id, scene id, optional camera settings
and optional control locks — validated on receipt. They never contain names,
photographs, device information or identifiers. Share cards are generated
locally and only leave the device when the user explicitly shares or downloads
them.

## The optional device camera

"Connect a camera" requests camera permission only after a direct button
press. It shows the connected device's live video (a USB-C camera in webcam
mode, an HDMI capture card, or a built-in camera) and can send setting changes
to that device. Frames are shown locally only and are never recorded, stored or
transmitted. The list of video sources shows device names reported by your
browser; these are not stored. Refusing permission disables nothing else.

## Exports

Downloaded and printed images are re-encoded from a canvas and therefore carry
no EXIF, GPS or hidden metadata. Camera-settings text appears on prints only
when the user leaves those options enabled.

## Children

The app is designed for young learners: it works fully anonymously, has no
social features, no messaging, no public galleries and no data collection —
so there is no personal data to misuse.
