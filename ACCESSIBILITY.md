# Accessibility — Tatu Exposure Lab

Target: **WCAG 2.2 AA**.

## Implemented

- **Keyboard**: every interactive element is reachable and operable by
  keyboard; sliders are native `<input type="range">` with −/+ steppers;
  dialogs use the native `<dialog>` element (focus trapping, Esc to close).
  Optional shortcuts (A/Z, S/X, I/K, arrows, Space, G, P, H) are documented
  in-app and never required.
- **Focus visibility**: 3px yellow `:focus-visible` outline on the dark theme,
  meeting contrast requirements on all backgrounds.
- **Screen readers**: labelled controls with `aria-valuetext` for photographic
  values ("f/5.6", "1/125"); the light meter is a `role="meter"` with a text
  readout; the histogram has a text alternative announcing clipping; change
  feedback uses a polite live region; canvas viewfinder has a descriptive
  `role="img"` label.
- **Structure**: one `<h1>` per page, logical heading order, skip-to-content
  link, labelled nav landmarks.
- **Colour**: state is never conveyed by colour alone — clipping warnings pair
  shape (▲/▼) and text, meter status is written out, badges show lock state
  with text. Palette contrast was chosen against #171717/#F3F1EC backgrounds.
- **High-contrast mode** and **large-control mode** (touch targets ≥56px,
  112.5% text) as user toggles, persisted locally.
- **Reduced motion**: honours `prefers-reduced-motion` and provides an
  in-app animations toggle; no essential information is animation-only.
- **Audio**: all sounds are optional (off by one toggle) and duplicated by
  visual feedback; no speech content requiring captions is used.
- **Text resizing**: relative units; layout verified at 200% zoom and 320px
  width without horizontal scrolling.
- **Touch**: 44×44 CSS px minimum targets (56px in large-control mode),
  bottom-reachable shutter button on mobile, safe-area insets respected.
- **Errors**: every error message states what happened and a useful next step,
  announced via `role="alert"`.

## Known limitations

- The live viewfinder is a visual simulation; its text alternative summarises
  scene and settings but cannot convey every pixel-level nuance. The numeric
  meter, histogram summary and change feedback carry the same teaching
  content in text.
- Printed worksheets are static documents; screen-reader users can use the
  in-app lessons, which cover identical content interactively.

## Testing

- Keyboard-only walkthrough of all pages each release.
- Screen reader spot checks (VoiceOver/NVDA patterns via ARIA roles).
- Playwright checks for landmarks, labels and status regions.
- Colour contrast validated for text and UI components against AA ratios.

Accessibility problems are treated as bugs — report them via the Support page.
