/** Support & bug report page. Generates a report the user can copy — nothing is sent automatically. */
import { useState } from 'react';
import { useI18n } from '../i18n';
import { APP_VERSION } from '../version';
import { sanitizeText } from '../engine/sanitize';
import { copyText } from '../utils/share';

export default function Support() {
  const { t } = useI18n();
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  const report = [
    `Tatu Exposure Lab bug report`,
    `Version: ${APP_VERSION}`,
    `Viewport: ${window.innerWidth}×${window.innerHeight}`,
    `Online: ${navigator.onLine}`,
    `Description: ${sanitizeText(description, 800)}`,
  ].join('\n');

  return (
    <div className="content-page">
      <h1>{t('navSupport')}</h1>
      <h2>Common questions</h2>
      <ul>
        <li><strong>The app looks dark/bright wrong:</strong> check the light meter — the simulator is doing what a real camera would. Reset exposure from the Simulator toolbar.</li>
        <li><strong>Camera permission was denied:</strong> that's fine — everything except the optional "Use My Camera" mode works without it. Re-enable it in your browser's site settings if you change your mind.</li>
        <li><strong>Photos disappeared:</strong> photographs live only on this device. Clearing browser data or using private browsing removes them.</li>
        <li><strong>Offline:</strong> after your first visit the core app, starter lesson and several scenes work offline. New scenes are cached as you open them.</li>
        <li><strong>Printing problems:</strong> use your browser's File → Print if the button fails, and pick "Save as PDF" as the destination for a PDF copy.</li>
      </ul>
      <h2>Report a bug</h2>
      <p>Describe what happened. Copy the report and send it to the Storitellah team or paste it into the project's issue tracker.</p>
      <textarea
        rows={4}
        style={{ width: '100%' }}
        maxLength={800}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label={t('navSupport')}
      />
      <pre className="card" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{report}</pre>
      <button
        type="button"
        className="btn primary"
        onClick={async () => setCopied(await copyText(report))}
      >
        {copied ? t('linkCopied') : t('copyLink')}
      </button>
    </div>
  );
}
