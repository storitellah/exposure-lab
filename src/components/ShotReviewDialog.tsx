/**
 * Shot review: shown after pressing the shutter. The photograph can be
 * kept (saved locally), downloaded, retaken or discarded; challenge shots
 * show the score breakdown and a share card.
 */
import { useEffect, useRef, useState } from 'react';
import { formatAperture, formatShutter, type ExposureSettings } from '../engine/settings';
import type { ScoreBreakdown } from '../engine/scoring';
import type { Challenge } from '../data/challenges';
import { useStore } from '../state/store';
import { gearLabel } from '../data/catalogue';
import { useI18n } from '../i18n';
import { keepShot, downloadBlob, type CaptureResult } from '../utils/capture';
import { renderShareCard, shareOrCopy, challengeLink, settingsSummary, copyText } from '../utils/share';
import { sanitizeText } from '../engine/sanitize';
import { sceneById } from '../scenes/scenes';
import { playSuccessSound } from '../utils/audio';

export function ShotReviewDialog({ capture, settings, meter, score, challenge, onClose, onRetake }: {
  capture: CaptureResult;
  settings: ExposureSettings;
  meter: number;
  score?: ScoreBreakdown;
  challenge?: Challenge;
  onClose: () => void;
  onRetake: () => void;
}) {
  const { state, camera, lens } = useStore();
  const { t, pick } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reflection, setReflection] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
    if (score && score.total >= 80) playSuccessSound(state.prefs.sound);
  }, [score, state.prefs.sound]);

  const onKeep = async () => {
    try {
      await keepShot({
        capture,
        sceneId: state.sceneId,
        cameraId: camera.id,
        lensId: lens.id,
        settings,
        meter,
        reflection: sanitizeText(reflection),
        ...(challenge ? { challengeId: challenge.id } : {}),
        ...(score ? { score } : {}),
      });
      setSaved(true);
    } catch {
      setError(t('errorStorage'));
    }
  };

  const onShare = async () => {
    if (!challenge) return;
    try {
      const blob = await renderShareCard({
        imageUrl: capture.dataUrl,
        challengeTitle: pick(challenge.title),
        settings,
        ...(score ? { score: score.total } : {}),
        learning: settingsSummary(settings),
      });
      downloadBlob(blob, `tatu-challenge-${challenge.id}.jpg`);
    } catch {
      setError(t('errorExport'));
    }
  };

  const scene = sceneById(state.sceneId);

  return (
    <dialog ref={dialogRef} aria-label={t('shotReview')} data-testid="shot-review" onClose={onClose}>
      <h2>{t('shotReview')}</h2>
      <img
        src={capture.dataUrl}
        alt={`${pick(scene)} — ${settingsSummary(settings)}`}
        style={{ borderRadius: '8px', cursor: 'zoom-in', ...(zoom ? { transform: 'scale(1.8)', transformOrigin: 'center' } : {}) }}
        onClick={() => setZoom(!zoom)}
        data-testid="review-image"
      />
      <p style={{ fontSize: '0.9rem' }}>
        <strong>{t('capturedWith')}:</strong> {gearLabel(camera)} + {gearLabel(lens)}<br />
        {formatAperture(settings.aperture)} · {formatShutter(settings.shutter)} · ISO {settings.iso} ·{' '}
        {settings.focalMm}mm · {t('evComp')} {settings.evComp >= 0 ? '+' : ''}{settings.evComp.toFixed(1)} ·{' '}
        {t('meter')} {meter >= 0 ? '+' : ''}{meter.toFixed(1)} · {new Date().toLocaleString()}
      </p>

      {score && (
        <div className="card" data-testid="score-breakdown">
          <h3>{t('challengeScore')}: {score.total}/100</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
            <li>{t('scoreExposure')}: {Math.round(score.exposure)}</li>
            <li>{t('scoreMotion')}: {Math.round(score.motion)}</li>
            <li>{t('scoreDof')}: {Math.round(score.dof)}</li>
            <li>{t('scoreFocus')}: {Math.round(score.focus)}</li>
            <li>{t('scoreNoise')}: {Math.round(score.noise)}</li>
            <li>{t('scoreCreative')}: {Math.round(score.creative)}</li>
          </ul>
        </div>
      )}

      <label htmlFor="reflection-input">{t('reflection')}</label>
      <textarea
        id="reflection-input"
        rows={2}
        maxLength={280}
        style={{ width: '100%' }}
        placeholder={t('reflectionPlaceholder')}
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
      />

      {error && <p className="notice error" role="alert">{error}</p>}
      {saved && <p className="notice success" role="status" data-testid="saved-note">{t('addToGallery')}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
        {!saved && (
          <button type="button" className="btn primary" data-testid="keep-button" onClick={() => void onKeep()}>
            {t('keepPhoto')}
          </button>
        )}
        <button type="button" className="btn" data-testid="download-button" onClick={() => downloadBlob(capture.blob, 'tatu-photo.jpg')}>
          {t('download')}
        </button>
        {challenge && (
          <>
            <button type="button" className="btn" onClick={() => void onShare()}>{t('downloadCard')}</button>
            <button
              type="button"
              className="btn"
              onClick={() => void shareOrCopy(pick(challenge.title), challengeLink({ challengeId: challenge.id, sceneId: challenge.sceneId }))}
            >
              {t('shareChallenge')}
            </button>
            <button type="button" className="btn" onClick={() => void copyText(settingsSummary(settings))}>
              {t('copySettings')}
            </button>
          </>
        )}
        <button type="button" className="btn" data-testid="retake-button" onClick={onRetake}>{t('retake')}</button>
        <button type="button" className="btn" data-testid="close-review" onClick={() => { dialogRef.current?.close(); }}>
          {t('close')}
        </button>
      </div>
    </dialog>
  );
}
