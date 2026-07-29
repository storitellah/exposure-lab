/** Teacher Mode: build classroom challenges, lock controls, QR, worksheets. */
import { useEffect, useRef, useState } from 'react';
import { CHALLENGES, challengeById } from '../data/challenges';
import { LESSONS } from '../data/lessons';
import { SCENES } from '../scenes/scenes';
import { useI18n } from '../i18n';
import { Link, useRouter } from '../router';
import { challengeLink, drawQr, copyText } from '../utils/share';
import { APERTURES, SHUTTERS, ISOS, formatAperture, formatShutter } from '../engine/settings';
import { solveShutter } from '../engine/exposure';
import { sceneById } from '../scenes/scenes';
import { nearest } from '../engine/settings';

export default function Teacher() {
  const { t, pick } = useI18n();
  const { navigate } = useRouter();
  const [challengeId, setChallengeId] = useState(CHALLENGES[0]?.id ?? '');
  const [sceneId, setSceneId] = useState(CHALLENGES[0]?.sceneId ?? '');
  const [locks, setLocks] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [copied, setCopied] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const challenge = challengeById(challengeId);
  const link = challengeLink({
    challengeId,
    sceneId,
    ...(locks.length ? { locked: locks as ('aperture' | 'shutter' | 'iso')[] } : {}),
  });

  useEffect(() => {
    if (qrRef.current) drawQr(qrRef.current, link);
  }, [link]);

  const toggleLock = (name: string) =>
    setLocks((l) => (l.includes(name) ? l.filter((x) => x !== name) : [...l, name]));

  return (
    <div>
      <h1>{t('teacherMode')}</h1>
      <p className="notice">{t('teacherIntro')}</p>

      <div className="card" style={{ display: 'grid', gap: '0.7rem', marginBottom: '1rem' }}>
        <h2>{t('createChallengeLink')}</h2>
        <label>
          {t('challenges')}{' '}
          <select
            value={challengeId}
            data-testid="teacher-challenge"
            onChange={(e) => {
              setChallengeId(e.target.value);
              const c = challengeById(e.target.value);
              if (c) setSceneId(c.sceneId);
            }}
          >
            {CHALLENGES.map((c) => <option key={c.id} value={c.id}>{pick(c.title)}</option>)}
          </select>
        </label>
        <label>
          {t('chooseScene')}{' '}
          <select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
            {SCENES.map((s) => <option key={s.id} value={s.id}>{pick(s)}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{t('lockControls')}</legend>
          {['aperture', 'shutter', 'iso'].map((name) => (
            <label key={name} style={{ display: 'inline-flex', gap: '0.3rem', marginRight: '1rem', alignItems: 'center' }}>
              <input type="checkbox" checked={locks.includes(name)} onChange={() => toggleLock(name)} />
              {name === 'aperture' ? t('aperture') : name === 'shutter' ? t('shutterSpeed') : 'ISO'}
            </label>
          ))}
        </fieldset>
        <label>
          {t('suggestedTime')}{' '}
          <input
            type="number" min={5} max={90} value={minutes}
            onChange={(e) => setMinutes(Math.max(5, Math.min(90, Number(e.target.value) || 15)))}
            style={{ width: '5rem' }}
          />{' '}
          {t('minutes')}
        </label>
        <p style={{ wordBreak: 'break-all', fontSize: '0.85rem' }} data-testid="teacher-link">{link}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button" className="btn primary"
            onClick={async () => setCopied(await copyText(link))}
          >
            {t('copyLink')}
          </button>
          {copied && <span role="status" className="meter-status ok">{t('linkCopied')}</span>}
          <button type="button" className="btn" onClick={() => navigate(`/challenges?${link.split('?')[1] ?? ''}`)}>
            {t('tryChallenge')}
          </button>
        </div>
        <canvas ref={qrRef} style={{ background: '#fff', borderRadius: '8px', maxWidth: '220px' }} aria-label={t('qrCode')} />
        <p style={{ fontSize: '0.85rem', color: 'var(--fg-dim)' }}>{t('projectorTip')}</p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>{t('answerGuide')}</h2>
        <button type="button" className="btn" onClick={() => setShowAnswers(!showAnswers)} aria-expanded={showAnswers}>
          {showAnswers ? t('close') : t('answerGuide')}
        </button>
        {showAnswers && challenge && <AnswerGuide sceneId={sceneId} />}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2>{t('lessonSequence')}</h2>
        <ol>
          {LESSONS.map((l) => <li key={l.id}><Link to={`/learn/${l.id}`}>{pick(l.title)}</Link></li>)}
        </ol>
      </div>

      <div className="card">
        <h2>{t('worksheets')}</h2>
        <p>
          <Link to="/print" className="btn">{t('printWorksheet')}</Link>{' '}
          <Link to="/print" className="btn">{t('printCertificate')}</Link>
        </p>
        <ul style={{ fontSize: '0.9rem' }}>
          <li>Exposure triangle worksheet — Print Studio → Worksheet</li>
          <li>Aperture / Shutter / ISO practice — Guided lessons 2–7 on a projector</li>
          <li>Manual mode checklist — lesson 8 (“Balancing all three settings”)</li>
          <li>Video shutter angle worksheet — Video page cadence table</li>
          <li>Photo challenge cards — each challenge’s share card (“{t('downloadCard')}”)</li>
        </ul>
      </div>
    </div>
  );
}

/** Example correct settings for a scene (one of many valid answers). */
function AnswerGuide({ sceneId }: { sceneId: string }) {
  const scene = sceneById(sceneId);
  const aperture = nearest(APERTURES, 5.6);
  const iso = nearest(ISOS, scene.ev100 >= 12 ? 200 : 1600);
  const shutter = nearest(SHUTTERS, solveShutter(scene.ev100, aperture, iso));
  return (
    <div className="table-scroll">
      <table className="data">
        <thead><tr><th>Scene EV</th><th>Example aperture</th><th>Example shutter</th><th>Example ISO</th></tr></thead>
        <tbody>
          <tr>
            <td>EV {scene.ev100}</td>
            <td>{formatAperture(aperture)}</td>
            <td>{formatShutter(shutter)}</td>
            <td>ISO {iso}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: '0.85rem' }}>
        Any combination within ±⅔ stop of this total exposure is equally correct — the creative
        trade-offs (depth of field, motion, noise) are the learning goal.
      </p>
    </div>
  );
}
