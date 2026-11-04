/**
 * Depth of Field Lab: how focus distance, aperture, focal length, sensor size
 * and the gap to the background shape what is sharp and how soft the
 * background becomes — shown three ways at once: the rendered preview, the
 * side-view diagram and the numbers. Guided experiments set up the classic
 * comparisons, and every term is explained in plain words and in depth.
 */
import { useMemo, useState } from 'react';
import { SceneCanvas } from '../components/SceneCanvas';
import { DepthOfFieldDiagram, formatDistance } from '../components/DepthOfFieldDiagram';
import { ControlSlider } from '../components/ControlSlider';
import { APERTURES, SHUTTERS, nearest, defaultSettings, formatAperture, type ExposureSettings } from '../engine/settings';
import { depthOfField, equivalentFocal, fieldOfViewDeg, FULL_FRAME, type SensorFormat } from '../engine/optics';
import { backgroundBlurPx } from '../engine/tradeoffs';
import { sceneById, type SceneDef } from '../scenes/scenes';
import { DEFAULT_NOISE } from '../engine/noise';
import { DOF_EXPLAINER_TERMS, focusTerm } from '../data/glossary-focus';
import type { GlossaryEntry } from '../data/glossary-core';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { Link } from '../router';
import { detectDefaultQuality } from '../utils/device';

const SENSORS: { id: string; key: TranslationKey; format: SensorFormat }[] = [
  { id: 'ff', key: 'sensorFullFrame', format: FULL_FRAME },
  { id: 'apsc', key: 'sensorApsc', format: { name: 'APS-C', widthMm: 23.5, heightMm: 15.6 } },
  { id: 'mft', key: 'sensorMft', format: { name: 'Micro Four Thirds', widthMm: 17.3, heightMm: 13 } },
  { id: 'one', key: 'sensorOneInch', format: { name: '1-inch', widthMm: 13.2, heightMm: 8.8 } },
];

const FOCALS = [14, 18, 24, 28, 35, 50, 70, 85, 105, 135, 200];
const LAB_APERTURES = APERTURES.filter((a) => a >= 1.4 && a <= 22);
const DISTANCES: number[] = (() => {
  const out: number[] = [];
  for (let d = 0.3; d < 100; d *= 1.15) out.push(Math.round(d * 100) / 100);
  out.push(100);
  return out;
})();
const SUBJECT_DISTANCES = DISTANCES.filter((d) => d >= 0.5 && d <= 20);
const GAPS = [0.5, 1, 2, 3, 5, 8, 12, 20, 30, 50];

interface LabState {
  aperture: number;
  focalMm: number;
  subjectDistM: number;
  backgroundGapM: number;
  focusDistM: number;
  followSubject: boolean;
  keepFraming: boolean;
  sensorId: string;
}

const START: LabState = {
  aperture: 2.8, focalMm: 50, subjectDistM: 2.5, backgroundGapM: 8,
  focusDistM: 2.5, followSubject: true, keepFraming: false, sensorId: 'ff',
};

interface Experiment {
  id: string;
  title: TranslationKey;
  note: TranslationKey;
  state: Partial<LabState>;
}

const EXPERIMENTS: Experiment[] = [
  { id: 'portrait', title: 'expPortrait', note: 'expPortraitNote',
    state: { aperture: 1.8, focalMm: 85, subjectDistM: 2.5, backgroundGapM: 12, followSubject: true, keepFraming: false, sensorId: 'ff' } },
  { id: 'closer', title: 'expCloser', note: 'expCloserNote',
    state: { aperture: 2.8, focalMm: 50, subjectDistM: 0.8, backgroundGapM: 8, followSubject: true, keepFraming: false, sensorId: 'ff' } },
  { id: 'wide', title: 'expWide', note: 'expWideNote',
    state: { aperture: 2.8, focalMm: 35, subjectDistM: 2, backgroundGapM: 8, followSubject: true, keepFraming: true, sensorId: 'ff' } },
  { id: 'tele', title: 'expTele', note: 'expTeleNote',
    state: { aperture: 2.8, focalMm: 135, subjectDistM: 7.7, backgroundGapM: 8, followSubject: true, keepFraming: true, sensorId: 'ff' } },
  { id: 'sensor', title: 'expSensor', note: 'expSensorNote',
    state: { aperture: 2.8, focalMm: 50, subjectDistM: 2.5, backgroundGapM: 8, followSubject: true, keepFraming: false, sensorId: 'mft' } },
  { id: 'landscape', title: 'expHyperfocal', note: 'expHyperfocalNote',
    state: { aperture: 11, focalMm: 24, subjectDistM: 3, backgroundGapM: 50, followSubject: false, keepFraming: false, sensorId: 'ff' } },
];

/** The outdoor portrait, with the subject and background moved to the lab's distances. */
function labScene(base: SceneDef, subjectDistM: number, gapM: number): SceneDef {
  const behind = base.layers.map((l) => l.distanceM).filter((d) => d > base.subjectDistM * 1.2 && d < 1000);
  const firstGap = (behind.length ? Math.min(...behind) : base.subjectDistM * 4) - base.subjectDistM;
  const layers = base.layers.map((l) => {
    if (Math.abs(l.distanceM - base.subjectDistM) < 1e-6) return { ...l, distanceM: subjectDistM };
    if (l.distanceM > base.subjectDistM && l.distanceM < 1000) {
      return { ...l, distanceM: subjectDistM + (l.distanceM - base.subjectDistM) * (gapM / firstGap) };
    }
    return l;
  });
  // Drawn layers only: photo bands carry their own fixed distances.
  const moved: SceneDef = { ...base, subjectDistM, layers };
  delete moved.photo;
  return moved;
}

function exposureFor(ev100: number, aperture: number): number {
  const t = (aperture * aperture) / 2 ** ev100;
  return nearest(SHUTTERS, Math.min(30, Math.max(1 / 8000, t)));
}

function Term({ e }: { e: GlossaryEntry }) {
  const { t, pick } = useI18n();
  return (
    <article className="dof-term card" id={`term-${e.id}`}>
      <h3>{pick(e.term)}</h3>
      <p><span className="glossary-label">{t('glossaryPlain')}</span> {pick(e.simple)}</p>
      <p><span className="glossary-label depth">{t('glossaryDepth')}</span> {pick(e.advanced)}</p>
    </article>
  );
}

export default function DepthOfFieldLab() {
  const { t } = useI18n();
  const [lab, setLab] = useState<LabState>(START);
  const [active, setActive] = useState<string | null>(null);
  const base = useMemo(() => sceneById('outdoor-portrait'), []);
  const sensor = (SENSORS.find((s) => s.id === lab.sensorId) ?? SENSORS[0])!.format;
  const focusDistM = lab.followSubject ? lab.subjectDistM : lab.focusDistM;
  const backgroundDistM = lab.subjectDistM + lab.backgroundGapM;
  const scene = useMemo(() => labScene(base, lab.subjectDistM, lab.backgroundGapM), [base, lab.subjectDistM, lab.backgroundGapM]);
  const quality = useMemo(() => detectDefaultQuality(), []);

  const settings: ExposureSettings = useMemo(() => ({
    ...defaultSettings(),
    aperture: lab.aperture,
    shutter: exposureFor(base.ev100, lab.aperture),
    iso: 100,
    focalMm: lab.focalMm,
    focusDistM,
    focusPoint: { x: 0.5, y: 0.45 },
  }), [lab.aperture, lab.focalMm, focusDistM, base.ev100]);

  const dof = depthOfField(lab.focalMm, lab.aperture, focusDistM, sensor);
  const bgBlur = backgroundBlurPx(lab.focalMm, lab.aperture, focusDistM, backgroundDistM, sensor);

  const set = (patch: Partial<LabState>) => { setActive(null); setLab((s) => ({ ...s, ...patch })); };
  const setFocal = (f: number) => setLab((s) => {
    setActive(null);
    if (!s.keepFraming) return { ...s, focalMm: f };
    // Step back (or forward) so the subject stays the same size in the frame.
    const subject = Math.min(20, Math.max(0.5, s.subjectDistM * (f / s.focalMm)));
    return { ...s, focalMm: f, subjectDistM: Math.round(subject * 100) / 100 };
  });
  const runExperiment = (e: Experiment) => {
    setLab(() => {
      const next = { ...START, ...e.state };
      if (e.id === 'landscape') {
        next.focusDistM = depthOfField(next.focalMm, next.aperture, 1, FULL_FRAME).hyperfocalM;
      }
      return next;
    });
    setActive(e.id);
  };
  const activeExp = EXPERIMENTS.find((e) => e.id === active);

  return (
    <div className="dof-lab">
      <header className="page-head">
        <h1>{t('dofLabTitle')}</h1>
        <p className="page-lead">{t('dofLabIntro')}</p>
      </header>

      <div className="dof-lab-grid">
        <section className="dof-lab-view" aria-label={t('livePreview')}>
          <SceneCanvas
            sceneId={scene.id}
            scene={scene}
            settings={settings}
            sensor={sensor}
            noiseProfile={DEFAULT_NOISE}
            quality={quality}
            ariaLabel={`${t('dofLabTitle')}: ${lab.focalMm}mm ${formatAperture(lab.aperture)}, ${t('dofFocus')} ${formatDistance(focusDistM)}`}
          />
          <p className="dof-preview-note">{t('dofPreviewNote')}</p>
          <DepthOfFieldDiagram
            focalMm={lab.focalMm}
            aperture={lab.aperture}
            focusDistM={focusDistM}
            sensor={sensor}
            subjectDistM={lab.subjectDistM}
            backgroundDistM={backgroundDistM}
          />
        </section>

        <aside className="panel dof-lab-controls" aria-label={t('settings')}>
          <h2 className="panel-title">{t('dofControls')}</h2>
          <ControlSlider label={t('aperture')} values={LAB_APERTURES} value={lab.aperture} format={formatAperture} onChange={(v) => set({ aperture: v })} />
          <ControlSlider label={t('focalLength')} values={FOCALS} value={lab.focalMm} format={(v) => `${v}mm`} onChange={setFocal} />
          <ControlSlider label={t('dofSubjectDistance')} values={SUBJECT_DISTANCES} value={lab.subjectDistM} format={formatDistance} onChange={(v) => set({ subjectDistM: v })} />
          <ControlSlider label={t('dofBackgroundGap')} values={GAPS} value={lab.backgroundGapM} format={formatDistance} onChange={(v) => set({ backgroundGapM: v })} />
          <ControlSlider
            label={t('focusDistance')}
            values={DISTANCES}
            value={focusDistM}
            format={formatDistance}
            onChange={(v) => set({ focusDistM: v, followSubject: false })}
          />
          <label className="check">
            <input type="checkbox" checked={lab.followSubject} onChange={(e) => set({ followSubject: e.target.checked, focusDistM: lab.subjectDistM })} />
            {t('dofFollowSubject')}
          </label>
          <label className="check">
            <input type="checkbox" checked={lab.keepFraming} onChange={(e) => set({ keepFraming: e.target.checked })} />
            {t('dofKeepFraming')}
          </label>
          <label className="field">
            <span>{t('dofSensor')}</span>
            <select value={lab.sensorId} onChange={(e) => set({ sensorId: e.target.value })} data-testid="dof-sensor">
              {SENSORS.map((s) => <option key={s.id} value={s.id}>{t(s.key)}</option>)}
            </select>
          </label>

          <dl className="dof-numbers" data-testid="dof-numbers">
            <div><dt>{t('dofSharpZone')}</dt><dd>{Number.isFinite(dof.farM) ? formatDistance(dof.totalM) : '∞'}</dd></div>
            <div><dt>{t('dofBlurDisc')}</dt><dd>{bgBlur.toFixed(1)} px</dd></div>
            <div><dt>{t('dofEquivalent')}</dt><dd>{Math.round(equivalentFocal(lab.focalMm, sensor))}mm</dd></div>
            <div><dt>{t('dofAngle')}</dt><dd>{Math.round(fieldOfViewDeg(lab.focalMm, sensor))}°</dd></div>
          </dl>
          <button type="button" className="btn" onClick={() => { setLab(START); setActive(null); }}>{t('dofReset')}</button>
        </aside>
      </div>

      <section className="dof-experiments" aria-labelledby="dof-exp-title">
        <h2 id="dof-exp-title">{t('dofExperiments')}</h2>
        <div className="dof-exp-list">
          {EXPERIMENTS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`chip ${active === e.id ? 'active' : ''}`}
              aria-pressed={active === e.id}
              onClick={() => runExperiment(e)}
              data-testid={`exp-${e.id}`}
            >
              {t(e.title)}
            </button>
          ))}
        </div>
        <p className="notice" role="status" data-testid="dof-exp-note">{activeExp ? t(activeExp.note) : t('dofExperimentsIntro')}</p>
      </section>

      <section className="dof-learn" aria-labelledby="dof-learn-title">
        <h2 id="dof-learn-title">{t('dofLearnTitle')}</h2>
        <div className="dof-terms">
          {DOF_EXPLAINER_TERMS.map((id) => focusTerm(id)).filter((e): e is GlossaryEntry => !!e).map((e) => <Term key={e.id} e={e} />)}
        </div>
        <p><Link to="/glossary#gloss-cat-focus">{t('dofMoreTerms')}</Link></p>
      </section>
    </div>
  );
}
