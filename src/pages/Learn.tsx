/** Guided Beginner Mode: lesson list and lesson runner. */
import { useLayoutEffect, useState } from 'react';
import { LESSONS, lessonById, lessonContext } from '../data/lessons';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { useRouter, Link } from '../router';
import { Simulator } from '../components/Simulator';
import { playSuccessSound } from '../utils/audio';

export default function Learn() {
  const { path } = useRouter();
  const lessonId = path.split('/')[2] ?? '';
  // `key` resets the runner's local result state when moving between lessons.
  if (lessonId) return <LessonRunner key={lessonId} lessonId={lessonId} />;
  return <LessonList />;
}

function LessonList() {
  const { t, pick } = useI18n();
  const { state } = useStore();
  return (
    <div>
      <h1>{t('guidedMode')}</h1>
      <p>{t('lessonProgress')}: {state.progress.completedLessons.length}/{LESSONS.length}</p>
      <ol style={{ display: 'grid', gap: '0.6rem', padding: 0, listStyle: 'none' }}>
        {LESSONS.map((lesson, i) => {
          const done = state.progress.completedLessons.includes(lesson.id);
          return (
            <li key={lesson.id} className="card">
              <Link to={`/learn/${lesson.id}`} ariaLabel={pick(lesson.title)}>
                <strong>{i + 1}. {pick(lesson.title)}</strong> {done ? '✓' : ''}
              </Link>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.9rem', color: 'var(--fg-dim)' }}>
                {pick(lesson.explanation).slice(0, 110)}…
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LessonRunner({ lessonId }: { lessonId: string }) {
  const { t, pick } = useI18n();
  const { state, dispatch } = useStore();
  const { navigate } = useRouter();
  const lesson = lessonById(lessonId);
  const [result, setResult] = useState<'none' | 'success' | 'retry'>('none');

  // Point the simulator at this lesson's scene and its deliberate starting
  // exposure, so the task begins away from the answer. A layout effect keeps
  // the first painted frame correct — the student never sees a flash of the
  // scene's default exposure before the lesson's.
  const sceneId = lesson?.sceneId;
  const startPatch = lesson?.startPatch;
  useLayoutEffect(() => {
    if (!sceneId) return;
    dispatch({
      type: 'set-scene',
      id: sceneId,
      applyStart: true,
      ...(startPatch ? { patch: startPatch } : {}),
    });
  }, [sceneId, startPatch, dispatch]);

  if (!lesson) {
    return <p className="notice error">{t('errorSceneUnavailable')} <Link to="/learn">{t('navLearn')}</Link></p>;
  }

  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[idx + 1];

  const check = () => {
    const ok = lesson.check(lessonContext(lesson, state.settings));
    if (ok) {
      setResult('success');
      dispatch({ type: 'complete-lesson', id: lesson.id });
      playSuccessSound(state.prefs.sound);
      if (state.progress.completedLessons.length + 1 >= LESSONS.length) {
        dispatch({ type: 'award-badge', id: 'triangle-master' });
      }
      if (lesson.id === 'aperture-dof') dispatch({ type: 'award-badge', id: 'aperture-explorer' });
      if (lesson.id === 'histogram') dispatch({ type: 'award-badge', id: 'histogram-reader' });
      if (lesson.id === 'balancing') dispatch({ type: 'award-badge', id: 'manual-mode-starter' });
    } else {
      setResult('retry');
    }
  };

  const controlName: Record<string, string> = {
    aperture: 'aperture', shutter: 'shutter', iso: 'iso',
    evComp: 'evComp', focalMm: 'focal', focusDistM: 'focus',
  };
  const controls = [...new Set([...lesson.unlocked.map((u) => controlName[u] ?? u), 'focus'])];

  return (
    <div>
      <nav aria-label="Lesson"><Link to="/learn">← {t('navLearn')}</Link></nav>
      <h1>{idx + 1}. {pick(lesson.title)}</h1>
      <details open>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('help')}</summary>
        <p>{pick(lesson.explanation)}</p>
      </details>
      <p className="notice"><strong>{t('lessonTask')}:</strong> {pick(lesson.task)}</p>

      <Simulator allowedControls={controls} />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
        <button type="button" className="btn primary" data-testid="lesson-check" onClick={check}>
          {t('lessonCheck')}
        </button>
        {result === 'retry' && (
          <button type="button" className="btn" onClick={() => setResult('none')}>{t('lessonRetry')}</button>
        )}
      </div>

      {result === 'success' && (
        <div className="notice success" role="status" data-testid="lesson-success">
          <p><strong>{t('lessonDone')}</strong> {pick(lesson.successFeedback)}</p>
          <p><strong>{t('lessonSummary')}:</strong> {pick(lesson.summary)}</p>
          {next ? (
            <button type="button" className="btn primary" onClick={() => navigate(`/learn/${next.id}`)}>
              {t('lessonNext')}: {pick(next.title)}
            </button>
          ) : (
            <Link to="/challenges" className="btn primary">{t('challenges')}</Link>
          )}
        </div>
      )}
      {result === 'retry' && (
        <p className="notice warning" role="status" data-testid="lesson-retry">{pick(lesson.retryFeedback)}</p>
      )}
    </div>
  );
}
