/** Accessibility statement and controls. */
import { useI18n } from '../i18n';
import { useStore } from '../state/store';

export default function AccessibilityPage() {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  return (
    <div className="content-page">
      <h1>{t('navAccessibility')}</h1>
      <p>
        Tatu Exposure Lab is built to meet WCAG 2.2 AA. Every feature works with a keyboard
        and a screen reader, information is never communicated by colour alone, and the
        interface respects your system's reduced-motion preference.
      </p>
      <h2>Quick settings</h2>
      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={state.prefs.highContrast} onChange={(e) => dispatch({ type: 'set-prefs', patch: { highContrast: e.target.checked } })} />
          {t('highContrast')}
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={state.prefs.largeControls} onChange={(e) => dispatch({ type: 'set-prefs', patch: { largeControls: e.target.checked } })} />
          {t('largeControls')}
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={state.prefs.animations} onChange={(e) => dispatch({ type: 'set-prefs', patch: { animations: e.target.checked } })} />
          {t('animations')}
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={state.prefs.sound} onChange={(e) => dispatch({ type: 'set-prefs', patch: { sound: e.target.checked } })} />
          {t('sound')}
        </label>
      </div>
      <h2>What we provide</h2>
      <ul>
        <li>Full keyboard navigation with visible focus indicators.</li>
        <li>Screen-reader labels on every control; the light meter and histogram announce their values as text.</li>
        <li>Logical heading structure and a skip-to-content link.</li>
        <li>High-contrast mode and large-control mode (touch targets grow to 56px).</li>
        <li>Reduced-motion support via system preference or the animations toggle.</li>
        <li>Colour-blind-safe exposure indicators: clipping warnings use shape (▲/▼), position and text, not colour alone.</li>
        <li>Text resizing: the layout works at 200% browser zoom.</li>
        <li>Optional keyboard shortcuts, documented in the Simulator's keyboard help.</li>
        <li>All sounds are optional and off-screen text alternatives are provided.</li>
      </ul>
      <h2>Feedback</h2>
      <p>
        If anything is hard to use with your assistive technology, please tell us via the
        Support page — accessibility reports are treated as bugs.
      </p>
    </div>
  );
}
