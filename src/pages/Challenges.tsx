/** Challenge Mode: list, daily pick, shared-link entry and play view. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGES, CHALLENGE_IDS, challengeById, type Challenge } from '../data/challenges';
import { SCENE_IDS } from '../scenes/scenes';
import { parseChallengeUrl } from '../engine/sanitize';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { useRouter, Link } from '../router';
import { Simulator } from '../components/Simulator';
import { challengeLink, shareOrCopy, drawQr } from '../utils/share';

/**
 * Daily practice challenge — a deterministic pick from the calendar day,
 * resolved once at module load so rendering stays pure.
 */
const DAILY_CHALLENGE = CHALLENGES[
  Math.floor(Date.now() / 86_400_000) % CHALLENGES.length
] as Challenge;

export default function Challenges() {
  const { search, navigate } = useRouter();
  const { dispatch } = useStore();

  // Deterministic challenge links: /challenges?c=<id>&sc=<scene>&lock=…
  // The active challenge is derived from the URL, so links, in-app starts
  // and the back button all behave identically.
  const parsed = useMemo(
    () => (search ? parseChallengeUrl(search, CHALLENGE_IDS, SCENE_IDS) : null),
    [search],
  );
  const active = parsed ? challengeById(parsed.challengeId) ?? null : null;
  const urlError = Boolean(search) && parsed === null;

  // Apply the link's scene, control locks and starting settings.
  useEffect(() => {
    if (!parsed) return;
    dispatch({ type: 'set-scene', id: parsed.sceneId, applyStart: true });
    dispatch({ type: 'set-locks', locks: parsed.locked ?? [] });
    const patch: Record<string, number> = {};
    if (parsed.aperture !== undefined) patch.aperture = parsed.aperture;
    if (parsed.shutter !== undefined) patch.shutter = parsed.shutter;
    if (parsed.iso !== undefined) patch.iso = parsed.iso;
    if (Object.keys(patch).length) dispatch({ type: 'set-settings', patch });
  }, [parsed, dispatch]);

  const startChallenge = (c: Challenge) => {
    navigate(`/challenges?c=${c.id}&sc=${c.sceneId}`);
  };

  const exitChallenge = () => {
    dispatch({ type: 'set-locks', locks: [] });
    navigate('/challenges');
  };

  if (active) return <ChallengePlay challenge={active} onExit={exitChallenge} />;

  return (
    <ChallengeList
      onStart={startChallenge}
      urlError={urlError}
      dismissError={() => navigate('/challenges')}
    />
  );
}

function ChallengeList({ onStart, urlError, dismissError }: {
  onStart: (c: Challenge) => void; urlError: boolean; dismissError: () => void;
}) {
  const { t, pick } = useI18n();
  const { state } = useStore();

  const random = () => {
    const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    if (c) onStart(c);
  };

  return (
    <div>
      <h1>{t('challenges')}</h1>
      {urlError && (
        <p className="notice error" role="alert">
          {t('errorSceneUnavailable')}{' '}
          <button type="button" className="btn" onClick={dismissError}>{t('close')}</button>
        </p>
      )}
      <div className="card" style={{ borderColor: 'var(--yellow)', marginBottom: '1rem' }}>
        <h2>☀ {t('dailyChallenge')}</h2>
        <p><strong>{pick(DAILY_CHALLENGE.title)}</strong> — {pick(DAILY_CHALLENGE.brief)}</p>
        <button type="button" className="btn primary" onClick={() => onStart(DAILY_CHALLENGE)}>
          {t('tryChallenge')}
        </button>
      </div>
      <button type="button" className="btn" onClick={random} style={{ marginBottom: '1rem' }}>
        🎲 {t('randomChallenge')}
      </button>
      <div className="mode-cards">
        {CHALLENGES.map((c) => (
          <div key={c.id} className="card">
            <h3>{c.video ? '🎬 ' : '📷 '}{pick(c.title)}</h3>
            <p style={{ fontSize: '0.9rem' }}>{pick(c.brief)}</p>
            {state.progress.bestScores[c.id] !== undefined && (
              <p style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                {t('personalBest')}: {state.progress.bestScores[c.id]}/100
              </p>
            )}
            <button type="button" className="btn primary" data-testid={`start-${c.id}`} onClick={() => onStart(c)}>
              {t('tryChallenge')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengePlay({ challenge, onExit }: { challenge: Challenge; onExit: () => void }) {
  const { t, pick } = useI18n();
  const { state } = useStore();
  const [showHint, setShowHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const link = challengeLink({ challengeId: challenge.id, sceneId: challenge.sceneId });

  useEffect(() => {
    if (showQr && qrRef.current) drawQr(qrRef.current, link);
  }, [showQr, link]);

  return (
    <div>
      <nav aria-label="Challenge"><button type="button" className="btn" onClick={onExit}>← {t('challenges')}</button></nav>
      <h1>{pick(challenge.title)}</h1>
      <p className="notice">{pick(challenge.brief)}</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <button type="button" className="btn" onClick={() => setShowHint(!showHint)}>{t('showHint')}</button>
        <button
          type="button"
          className="btn"
          onClick={async () => { setCopied((await shareOrCopy(pick(challenge.title), link)) === 'copied'); }}
        >
          {t('shareChallenge')}
        </button>
        <button type="button" className="btn" onClick={() => setShowQr(!showQr)}>{t('qrCode')}</button>
        {copied && <span role="status" className="meter-status ok">{t('linkCopied')}</span>}
        {state.progress.bestScores[challenge.id] !== undefined && (
          <span className="badge-chip">★ {t('personalBest')}: {state.progress.bestScores[challenge.id]}</span>
        )}
      </div>
      {showHint && <p className="notice warning">{pick(challenge.hint)}</p>}
      {showQr && <canvas ref={qrRef} style={{ background: '#fff', borderRadius: '8px' }} aria-label={t('qrCode')} />}
      <Simulator challenge={challenge} video={challenge.video ?? false} />
      <p style={{ marginTop: '0.6rem' }}>
        <Link to="/gallery">{t('gallery')} →</Link>
      </p>
    </div>
  );
}
