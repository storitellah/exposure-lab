/** Home: hero, first-launch onboarding, mode cards and progress. */
import { useEffect, useRef, useState } from 'react';
import { Link } from '../router';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { Wordmark } from '../components/Wordmark';
import { TriangleAnimation } from '../components/TriangleAnimation';

const BADGE_KEYS = {
  'aperture-explorer': 'badgeApertureExplorer',
  'motion-freezer': 'badgeMotionFreezer',
  'low-light-solver': 'badgeLowLight',
  'manual-mode-starter': 'badgeManualStarter',
  'histogram-reader': 'badgeHistogramReader',
  'portrait-maker': 'badgePortraitMaker',
  'video-exposure-starter': 'badgeVideoStarter',
  'triangle-master': 'badgeTriangleMaster',
} as const;

export default function Home() {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  const [onboardStep, setOnboardStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!state.prefs.onboardingDone) dialogRef.current?.showModal();
  }, [state.prefs.onboardingDone]);

  const finishOnboarding = () => {
    dispatch({ type: 'set-prefs', patch: { onboardingDone: true } });
    dialogRef.current?.close();
  };

  const steps = [
    { title: t('onboardingWelcome'), body: t('tatuMeaning') },
    { title: t('onboardingMeet'), body: `${t('aperture')} · ${t('shutterSpeed')} · ${t('iso')}` },
    { title: t('onboardingChooseMode'), body: `${t('guidedMode')} / ${t('freeMode')}` },
    { title: t('onboardingPhotoVideo'), body: `${t('photography')} / ${t('video')}` },
    { title: t('onboardingFirstShot'), body: t('tagline') },
  ];
  const step = steps[Math.min(onboardStep, steps.length - 1)];

  return (
    <div>
      <section className="home-hero">
        <Wordmark size={72} />
        <h1>{t('appName')} <span style={{ fontSize: '0.5em', color: 'var(--fg-dim)' }}>{t('byStoritellah')}</span></h1>
        <p className="tagline">{t('tagline')}</p>
        <p style={{ maxWidth: '560px', margin: '0 auto' }}>{t('tatuMeaning')}</p>
        <TriangleAnimation />
      </section>

      <section className="mode-cards">
        <Link to="/learn" className="card" ariaLabel={t('guidedMode')}>
          <h2>📗 {t('guidedMode')}</h2>
          <p>{t('lessonProgress')}: {state.progress.completedLessons.length}/12</p>
        </Link>
        <Link to="/simulator" className="card" ariaLabel={t('freeMode')}>
          <h2>📷 {t('freeMode')}</h2>
          <p>{t('tagline')}</p>
        </Link>
        <Link to="/video" className="card" ariaLabel={t('videoSimulator')}>
          <h2>🎬 {t('videoSimulator')}</h2>
          <p>{t('angleRule')}</p>
        </Link>
        <Link to="/challenges" className="card" ariaLabel={t('challenges')}>
          <h2>🏆 {t('challenges')}</h2>
          <p>{t('dailyChallenge')}</p>
        </Link>
      </section>

      {state.prefs.gamification && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>{t('badges')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(BADGE_KEYS).map(([id, key]) => (
              <span key={id} className={`badge-chip ${state.progress.badges.includes(id) ? '' : 'locked'}`}>
                ★ {t(key)}
              </span>
            ))}
          </div>
          {state.progress.streakDays > 0 && (
            <p>{t('streak')}: {state.progress.streakDays} {t('days')}</p>
          )}
        </section>
      )}

      <dialog ref={dialogRef} aria-label={t('onboardingWelcome')} data-testid="onboarding">
        <h2>{step?.title}</h2>
        <p>{step?.body}</p>
        {onboardStep === 1 && <TriangleAnimation />}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onboardStep > 0 && (
            <button type="button" className="btn" onClick={() => setOnboardStep(onboardStep - 1)}>{t('back')}</button>
          )}
          {onboardStep < steps.length - 1 ? (
            <button type="button" className="btn primary" onClick={() => setOnboardStep(onboardStep + 1)}>{t('next')}</button>
          ) : (
            <Link to="/simulator" className="btn primary" onNavigate={finishOnboarding}>{t('start')}</Link>
          )}
          <button type="button" className="btn" data-testid="skip-onboarding" onClick={finishOnboarding}>
            {t('onboardingSkip')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
