/** Privacy policy page. */
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { clearAllLocalData } from '../state/db';

export default function Privacy() {
  const { t } = useI18n();
  const { dispatch } = useStore();
  const clearAll = async () => {
    if (!window.confirm(t('clearConfirm'))) return;
    await clearAllLocalData();
    dispatch({ type: 'reset-progress' });
  };
  return (
    <div className="content-page">
      <h1>{t('navPrivacy')}</h1>
      <p><strong>The short version: your photos and progress never leave this device.</strong></p>
      <h2>What we do</h2>
      <ul>
        <li>No account, registration, or payment is ever required.</li>
        <li>Photographs, lesson progress, badges and streaks are stored only on this device (IndexedDB and localStorage).</li>
        <li>Exports and prints are generated locally in your browser.</li>
        <li>Exported images contain no GPS or hidden metadata — only the picture (camera-settings text is visible on prints when you choose to include it).</li>
        <li>Challenge links contain only the challenge name, scene name and camera settings — never names, scores you didn't choose to share, or anything personal.</li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>No photographs are uploaded. No cloud storage.</li>
        <li>No facial recognition. No location tracking. No fingerprinting.</li>
        <li>No advertising trackers and no analytics beacons.</li>
        <li>No contact-list access and no microphone permission — the app never asks.</li>
        <li>No cookies are set by the application.</li>
        <li>We do not collect names, ages, school information, or contact details.</li>
      </ul>
      <h2>The optional camera mode</h2>
      <p>
        "{t('useMyCamera')}" asks for camera permission only after you press its button, works
        entirely on your device, and can be refused with no loss of any other feature.
      </p>
      <h2>Deleting your data</h2>
      <p>Everything can be removed in one tap:</p>
      <button type="button" className="btn danger" onClick={() => void clearAll()}>{t('clearAllData')}</button>
    </div>
  );
}
