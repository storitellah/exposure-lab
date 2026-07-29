/**
 * The heart of the app: live simulated viewfinder, exposure controls,
 * capture flow with shot review, and cause-and-effect feedback.
 * Used by the Simulator page, Video page, lessons and challenges.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APERTURES, SHUTTERS, ISOS, formatAperture, formatShutter,
  type ExposureSettings, type ShootMode, type WhiteBalance, type Metering, type Drive,
} from '../engine/settings';
import { meterReading, describeStopChange, settingsEV100 } from '../engine/exposure';
import { resolveExposure } from '../engine/autoexposure';
import { depthOfField, equivalentFocal } from '../engine/optics';
import { FRAME_RATES, SHUTTER_ANGLES, shutterFromAngle, angleFromShutter, formatAngle } from '../engine/video';
import { scoreChallenge, type ScoreBreakdown } from '../engine/scoring';
import { sceneById, SCENES } from '../scenes/scenes';
import type { HistogramData } from '../scenes/renderer';
import { sensorOf, limitsOf } from '../data/catalogue';
import type { Challenge } from '../data/challenges';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import { SceneCanvas } from './SceneCanvas';
import { Meter } from './Meter';
import { Histogram } from './Histogram';
import { ShotReviewDialog } from './ShotReviewDialog';
import { captureScene, type CaptureResult } from '../utils/capture';
import { playShutterSound } from '../utils/audio';
import { haptic, detectDefaultQuality } from '../utils/device';
import { ControlSlider } from './ControlSlider';

export interface SimulatorProps {
  video?: boolean;
  challenge?: Challenge;
  /** Restrict which controls are shown/enabled (lesson & teacher modes). */
  allowedControls?: string[];
  onCaptureScored?: (score: ScoreBreakdown) => void;
  compact?: boolean;
}

interface PendingShot {
  capture: CaptureResult;
  settings: ExposureSettings;
  meter: number;
  score?: ScoreBreakdown;
}

export function Simulator({
  video = false, challenge, allowedControls, onCaptureScored, compact = false,
}: SimulatorProps) {
  const { state, dispatch, camera, lens, update } = useStore();
  const { t, pick } = useI18n();
  const scene = sceneById(state.sceneId);
  const sensor = sensorOf(camera);
  const [hist, setHist] = useState<HistogramData | null>(null);
  const [pending, setPending] = useState<PendingShot | null>(null);
  const [changeMsg, setChangeMsg] = useState('');
  const [fps, setFps] = useState<number>(24);
  const prevRef = useRef<ExposureSettings>(state.settings);

  const quality = state.prefs.quality === 'auto' ? detectDefaultQuality() : state.prefs.quality;
  const resolved = useMemo(
    () => resolveExposure(scene.ev100, state.settings, limitsOf(camera, lens)),
    [scene.ev100, state.settings, camera, lens],
  );
  const meter = meterReading(scene.ev100, {
    aperture: resolved.aperture, shutter: resolved.shutter, iso: resolved.iso,
    ndStops: resolved.ndStops, evComp: resolved.evComp,
  });
  const dof = depthOfField(resolved.focalMm, resolved.aperture, resolved.focusDistM, sensor);

  const lockedControls = state.lockedControls;
  const allowed = useCallback(
    (name: string) => !allowedControls || allowedControls.includes(name),
    [allowedControls],
  );
  const canUse = useCallback(
    (name: string) => allowed(name) && !lockedControls.includes(name),
    [allowed, lockedControls],
  );

  /* Cause-and-effect feedback when a setting changes. */
  useEffect(() => {
    const prev = prevRef.current;
    const cur = state.settings;
    if (prev === cur) return;
    const prevEv = settingsEV100({ aperture: prev.aperture, shutter: prev.shutter, iso: prev.iso, ndStops: prev.ndStops });
    const curEv = settingsEV100({ aperture: cur.aperture, shutter: cur.shutter, iso: cur.iso, ndStops: cur.ndStops });
    const stops = prevEv - curEv; // positive = brighter now
    let what = '';
    let consequence = '';
    if (prev.aperture !== cur.aperture) {
      what = `${formatAperture(prev.aperture)} → ${formatAperture(cur.aperture)}`;
      consequence = cur.aperture < prev.aperture
        ? 'Depth of field is shallower — more background blur.'
        : 'Depth of field is deeper — more of the scene is sharp.';
    } else if (prev.shutter !== cur.shutter) {
      what = `${formatShutter(prev.shutter)} → ${formatShutter(cur.shutter)}`;
      consequence = cur.shutter < prev.shutter
        ? 'Less motion blur — action freezes more easily.'
        : 'More motion blur — movement will streak.';
    } else if (prev.iso !== cur.iso) {
      what = `ISO ${prev.iso} → ISO ${cur.iso}`;
      consequence = cur.iso > prev.iso ? 'More visible noise and less fine detail.' : 'Cleaner image with finer detail.';
    }
    if (what) setChangeMsg(`${what} ${describeStopChange(stops)}. ${consequence}`);
    prevRef.current = cur;
  }, [state.settings]);

  const onFocusTap = useCallback((x: number, y: number, estimatedDistM: number) => {
    update({ focusPoint: { x, y }, focusDistM: estimatedDistM });
  }, [update]);

  const doCapture = async () => {
    playShutterSound(state.prefs.sound);
    haptic();
    const capture = await captureScene({
      scene, settings: resolved, sensor, noiseProfile: camera.noise,
      vignetting: lens.vignetting as 'low' | 'medium' | 'high',
    });
    let score: ScoreBreakdown | undefined;
    if (challenge) {
      score = scoreChallenge(challenge.goal, resolved, {
        sceneEV100: scene.ev100, subjectSpeedPxPerS: scene.subjectSpeedPxPerS, sensor,
      });
      dispatch({ type: 'record-score', challengeId: challenge.id, score: score.total });
      if (score.total >= 80 && challenge.badge) {
        dispatch({ type: 'award-badge', id: challenge.badge });
      }
      onCaptureScored?.(score);
    } else {
      dispatch({ type: 'record-practice' });
    }
    setPending({ capture, settings: resolved, meter, ...(score !== undefined ? { score } : {}) });
  };

  /*
   * Keyboard shortcuts (documented in Help; optional).
   * The listener is registered once and reads the latest handlers through a
   * ref, so typing never re-subscribes the window event.
   */
  const latest = useRef({ doCapture, settings: state.settings, canUse, busy: pending !== null, update });
  useEffect(() => {
    latest.current = { doCapture, settings: state.settings, canUse, busy: pending !== null, update };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { doCapture: capture, settings, canUse: usable, busy, update: set } = latest.current;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || busy) return;
      const stepTable = (table: number[], cur: number, dir: number, key: keyof ExposureSettings) => {
        const idx = table.findIndex((v) => Math.abs(Math.log(v) - Math.log(cur)) < 0.01);
        const next = table[Math.min(table.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + dir))];
        if (next !== undefined) set({ [key]: next } as Partial<ExposureSettings>);
      };
      switch (e.key.toLowerCase()) {
        case 'a': if (usable('aperture')) stepTable(APERTURES, settings.aperture, -1, 'aperture'); break;
        case 'z': if (usable('aperture')) stepTable(APERTURES, settings.aperture, 1, 'aperture'); break;
        case 's': if (usable('shutter')) stepTable(SHUTTERS, settings.shutter, 1, 'shutter'); break;
        case 'x': if (usable('shutter')) stepTable(SHUTTERS, settings.shutter, -1, 'shutter'); break;
        case 'i': if (usable('iso')) stepTable(ISOS, settings.iso, 1, 'iso'); break;
        case 'k': if (usable('iso')) stepTable(ISOS, settings.iso, -1, 'iso'); break;
        case ' ': e.preventDefault(); void capture(); break;
        case 'arrowleft': set({ focusPoint: { ...settings.focusPoint, x: Math.max(0, settings.focusPoint.x - 0.05) } }); break;
        case 'arrowright': set({ focusPoint: { ...settings.focusPoint, x: Math.min(1, settings.focusPoint.x + 0.05) } }); break;
        case 'arrowup': set({ focusPoint: { ...settings.focusPoint, y: Math.max(0, settings.focusPoint.y - 0.05) } }); break;
        case 'arrowdown': set({ focusPoint: { ...settings.focusPoint, y: Math.min(1, settings.focusPoint.y + 0.05) } }); break;
        default: return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const focalValues = useMemo(() => {
    if (lens.minFocal === lens.maxFocal) return [lens.minFocal];
    const out: number[] = [];
    for (let f = lens.minFocal; f <= lens.maxFocal; f += Math.max(1, Math.round((lens.maxFocal - lens.minFocal) / 24))) {
      out.push(Math.round(f));
    }
    if (out[out.length - 1] !== lens.maxFocal) out.push(lens.maxFocal);
    return out;
  }, [lens]);

  const focusValues = useMemo(() => {
    const out: number[] = [];
    for (let d = Math.max(0.1, lens.minFocusM); d < 100; d *= 1.3) out.push(Math.round(d * 100) / 100);
    out.push(100);
    return out;
  }, [lens]);

  const scenes = video ? SCENES.filter((s) => s.video) : SCENES;

  return (
    <div className={compact ? '' : 'simulator-grid'}>
      <div className="sim-preview">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <label htmlFor="scene-select">{t('scene')}</label>
          <select
            id="scene-select"
            data-testid="scene-select"
            value={state.sceneId}
            onChange={(e) => dispatch({ type: 'set-scene', id: e.target.value, applyStart: true })}
          >
            {scenes.map((s) => <option key={s.id} value={s.id}>{pick(s)}</option>)}
          </select>
          <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'undo' })} aria-label={t('undo')}>↶</button>
          <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'redo' })} aria-label={t('redo')}>↷</button>
          <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'reset-exposure' })}>{t('resetExposure')}</button>
        </div>

        <SceneCanvas
          sceneId={state.sceneId}
          settings={resolved}
          sensor={sensor}
          noiseProfile={camera.noise}
          quality={quality}
          vignetting={lens.vignetting as 'low' | 'medium' | 'high'}
          onHistogram={setHist}
          onFocusTap={onFocusTap}
          ariaLabel={`${pick(scene)} — ${formatAperture(resolved.aperture)}, ${formatShutter(resolved.shutter)}, ISO ${resolved.iso}`}
        />
        <div className="vf-readout" style={{ position: 'static', borderRadius: '0 0 12px 12px' }}>
          <span data-testid="readout-aperture">{formatAperture(resolved.aperture)}</span>
          <span data-testid="readout-shutter">{formatShutter(resolved.shutter)}</span>
          <span data-testid="readout-iso">ISO {resolved.iso}</span>
          {video && <span>{fps} fps · {formatAngle(Math.round(angleFromShutter(resolved.shutter, fps)))}</span>}
          <span>{equivalentFocal(resolved.focalMm, sensor).toFixed(0)}mm eq.</span>
          <span>
            DoF {dof.totalM === Infinity ? '∞' : `${dof.totalM.toFixed(2)}m`}
          </span>
        </div>

        <p className="change-toast" role="status" aria-live="polite" data-testid="change-feedback">
          {changeMsg || t('tagline')}
        </p>
      </div>

      <div className="shutter-dock">
        <button
          type="button"
          className="shutter-btn"
          data-testid="shutter-button"
          aria-label={t('takePhoto')}
          onClick={() => void doCapture()}
        >
          {t('takePhoto')}
        </button>
      </div>

      <div className="control-panel">
        {allowed('mode') && !video && (
          <div className="control-row">
            <label className="control-label" htmlFor="mode-dial">{t('mode')}</label>
            <select
              id="mode-dial"
              data-testid="mode-dial"
              value={state.settings.mode}
              onChange={(e) => update({ mode: e.target.value as ShootMode })}
            >
              <option value="M">M — {t('modeManual')}</option>
              <option value="A">A — {t('modeAperturePriority')}</option>
              <option value="S">S — {t('modeShutterPriority')}</option>
              <option value="P">P — {t('modeProgram')}</option>
            </select>
            <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={state.settings.autoIso}
                onChange={(e) => update({ autoIso: e.target.checked })}
              />
              {t('autoIso')}
            </label>
          </div>
        )}

        {video && (
          <>
            <div className="control-row">
              <label className="control-label" htmlFor="fps-select">{t('frameRate')}</label>
              <select
                id="fps-select"
                value={fps}
                onChange={(e) => {
                  const f = Number(e.target.value);
                  setFps(f);
                  update({ shutter: shutterFromAngle(180, f) });
                }}
              >
                {FRAME_RATES.filter((f) => camera.videoFps.length === 0 || camera.videoFps.includes(f)).map((f) => (
                  <option key={f} value={f}>{f} fps</option>
                ))}
              </select>
            </div>
            <div className="control-row">
              <label className="control-label" htmlFor="angle-select">{t('shutterAngle')}</label>
              <select
                id="angle-select"
                value={SHUTTER_ANGLES.reduce((best, a) =>
                  Math.abs(shutterFromAngle(a, fps) - state.settings.shutter) <
                  Math.abs(shutterFromAngle(best, fps) - state.settings.shutter) ? a : best, 180 as number)}
                onChange={(e) => update({ shutter: shutterFromAngle(Number(e.target.value), fps) })}
              >
                {SHUTTER_ANGLES.map((a) => (
                  <option key={a} value={a}>{formatAngle(a)} = {formatShutter(shutterFromAngle(a, fps))}</option>
                ))}
              </select>
            </div>
            <p className="notice" style={{ fontSize: '0.82rem' }}>{t('angleRule')}</p>
          </>
        )}

        {allowed('aperture') && (
          <ControlWithLock name="aperture" lockedList={state.lockedControls}>
            <SliderRow
              label={t('aperture')}
              values={APERTURES.filter((a) => a >= lens.maxAperture && a <= lens.minAperture)}
              value={resolved.aperture}
              format={formatAperture}
              disabled={!canUse('aperture') || (!video && state.settings.mode === 'S') || (!video && state.settings.mode === 'P')}
              onChange={(v) => update({ aperture: v })}
            />
          </ControlWithLock>
        )}
        {allowed('shutter') && !video && (
          <ControlWithLock name="shutter" lockedList={state.lockedControls}>
            <SliderRow
              label={t('shutterSpeed')}
              values={[...SHUTTERS].reverse()}
              value={resolved.shutter}
              format={formatShutter}
              disabled={!canUse('shutter') || state.settings.mode === 'A' || state.settings.mode === 'P'}
              onChange={(v) => update({ shutter: v })}
            />
          </ControlWithLock>
        )}
        {allowed('iso') && (
          <ControlWithLock name="iso" lockedList={state.lockedControls}>
            <SliderRow
              label="ISO"
              values={ISOS.filter((i) => i >= camera.isoExtMin && i <= camera.isoExtMax)}
              value={resolved.iso}
              format={(v) => `${v}`}
              disabled={!canUse('iso') || state.settings.autoIso}
              onChange={(v) => update({ iso: v })}
            />
          </ControlWithLock>
        )}
        {allowed('evComp') && (
          <SliderRow
            label={t('evComp')}
            values={Array.from({ length: 31 }, (_, i) => (i - 15) / 3)}
            value={state.settings.evComp}
            format={(v) => `${v >= 0 ? '+' : ''}${(Math.round(v * 3) / 3).toFixed(1)}`}
            onChange={(v) => update({ evComp: v })}
            linearMatch
          />
        )}
        {allowed('focal') && (
          <SliderRow
            label={t('focalLength')}
            values={focalValues}
            value={state.settings.focalMm}
            format={(v) => `${v}mm`}
            disabled={focalValues.length < 2}
            onChange={(v) => update({ focalMm: v })}
          />
        )}
        {allowed('focus') && (
          <SliderRow
            label={t('focusDistance')}
            values={focusValues}
            value={state.settings.focusDistM}
            format={(v) => (v >= 100 ? '∞' : `${v}m`)}
            onChange={(v) => update({ focusDistM: v })}
          />
        )}

        <Meter reading={meter} />
        {hist && <Histogram data={hist} />}

        {allowed('advanced') && (
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('settings')}</summary>
            <div style={{ display: 'grid', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <label>
                {t('whiteBalance')}{' '}
                <select value={state.settings.whiteBalance} onChange={(e) => update({ whiteBalance: e.target.value as WhiteBalance })}>
                  <option value="auto">{t('wbAuto')}</option>
                  <option value="daylight">{t('wbDaylight')}</option>
                  <option value="cloudy">{t('wbCloudy')}</option>
                  <option value="shade">{t('wbShade')}</option>
                  <option value="tungsten">{t('wbTungsten')}</option>
                  <option value="fluorescent">{t('wbFluorescent')}</option>
                  <option value="flash">{t('wbFlash')}</option>
                </select>
              </label>
              <label>
                {t('metering')}{' '}
                <select value={state.settings.metering} onChange={(e) => update({ metering: e.target.value as Metering })}>
                  <option value="matrix">{t('meterMatrix')}</option>
                  <option value="centre">{t('meterCentre')}</option>
                  <option value="spot">{t('meterSpot')}</option>
                </select>
              </label>
              <label>
                {t('driveMode')}{' '}
                <select value={state.settings.drive} onChange={(e) => update({ drive: e.target.value as Drive })}>
                  <option value="single">{t('driveSingle')}</option>
                  <option value="continuous">{t('driveContinuous')}</option>
                  <option value="timer">{t('driveTimer')}</option>
                </select>
              </label>
              <label>
                {t('ndFilter')}{' '}
                <select value={state.settings.ndStops} onChange={(e) => update({ ndStops: Number(e.target.value) })}>
                  <option value={0}>—</option>
                  <option value={3}>ND8 (3 {t('stops')})</option>
                  <option value={6}>ND64 (6 {t('stops')})</option>
                  <option value={10}>ND1000 (10 {t('stops')})</option>
                </select>
              </label>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={state.settings.stabilisation} onChange={(e) => update({ stabilisation: e.target.checked })} />
                {t('stabilisation')} {camera.ibis || lens.stabilised ? '' : '(—)'}
              </label>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={state.settings.flash} onChange={(e) => update({ flash: e.target.checked })} disabled={camera.flashSync === 0} />
                {t('flash')}
              </label>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={state.settings.manualFocus} onChange={(e) => update({ manualFocus: e.target.checked })} disabled={!lens.af} />
                {t('manualFocus')} {lens.af ? '' : `(${t('limitManualFocus')})`}
              </label>
            </div>
          </details>
        )}
      </div>

      {pending && (
        <ShotReviewDialog
          capture={pending.capture}
          settings={pending.settings}
          meter={pending.meter}
          score={pending.score}
          challenge={challenge}
          onClose={() => setPending(null)}
          onRetake={() => setPending(null)}
        />
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function SliderRow(props: {
  label: string; values: number[]; value: number; format: (v: number) => string;
  onChange: (v: number) => void; disabled?: boolean; linearMatch?: boolean;
}) {
  // ControlSlider matches on a log scale, which breaks for values ≤ 0
  // (exposure compensation). Shift into positive space when needed.
  if (props.linearMatch) {
    const offset = 10;
    return (
      <ControlSlider
        label={props.label}
        values={props.values.map((v) => v + offset)}
        value={props.value + offset}
        format={(v) => props.format(v - offset)}
        onChange={(v) => props.onChange(Math.round((v - offset) * 3) / 3)}
        disabled={props.disabled ?? false}
      />
    );
  }
  return (
    <ControlSlider
      label={props.label}
      values={props.values}
      value={props.value}
      format={props.format}
      onChange={props.onChange}
      disabled={props.disabled ?? false}
    />
  );
}

function ControlWithLock({ name, lockedList, children }: {
  name: string; lockedList: string[]; children: React.ReactNode;
}) {
  const isLocked = lockedList.includes(name);
  return (
    <div style={isLocked ? { opacity: 0.55 } : undefined} aria-disabled={isLocked || undefined}>
      {children}
      {isLocked && <span className="sr-only">locked by teacher</span>}
    </div>
  );
}
