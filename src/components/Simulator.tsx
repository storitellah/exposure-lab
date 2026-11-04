/**
 * The heart of the app: live simulated viewfinder, exposure controls,
 * capture flow with shot review, and cause-and-effect feedback.
 * Used by the Simulator page, Video page, lessons and challenges.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APERTURES, SHUTTERS, ISOS, formatAperture, formatShutter,
  type ExposureSettings, type ShootMode,
} from '../engine/settings';
import { cameraWhiteBalance, castKind, whiteBalanceShift } from '../engine/whitebalance';
import { meterReading, describeStopChange, settingsEV100 } from '../engine/exposure';
import { resolveExposure } from '../engine/autoexposure';
import { depthOfField, equivalentFocal } from '../engine/optics';
import { FRAME_RATES, SHUTTER_ANGLES, shutterFromAngle, angleFromShutter, formatAngle } from '../engine/video';
import { scoreChallenge, type ScoreBreakdown } from '../engine/scoring';
import { sceneById, SCENES, backgroundDistanceOf } from '../scenes/scenes';
import type { HistogramData } from '../scenes/renderer';
import { sensorOf, limitsOf, maxApertureAt } from '../data/catalogue';
import type { Challenge } from '../data/challenges';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { SceneCanvas } from './SceneCanvas';
import { Meter } from './Meter';
import { Histogram } from './Histogram';
import { ShotReviewDialog } from './ShotReviewDialog';
import { captureScene, type CaptureResult } from '../utils/capture';
import { playShutterSound } from '../utils/audio';
import { haptic, detectDefaultQuality } from '../utils/device';
import { ControlSlider } from './ControlSlider';
import { ExposureTriangle } from './ExposureTriangle';
import { WhiteBalanceControl } from './WhiteBalanceControl';
import { DepthOfFieldDiagram } from './DepthOfFieldDiagram';
import { Link } from '../router';

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

const WB_KEYS = {
  auto: 'wbAuto', daylight: 'wbDaylight', cloudy: 'wbCloudy', shade: 'wbShade', tungsten: 'wbTungsten',
  fluorescent: 'wbFluorescent', flash: 'wbFlash', custom: 'wbCustom',
} as const satisfies Record<ExposureSettings['whiteBalance'], TranslationKey>;

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
  // Stabilisation only helps if the body (IBIS) or lens (IS/VR/OIS) has it.
  const hasStabilisation = camera.ibis || lens.stabilised;
  const resolved = useMemo(() => {
    const r = resolveExposure(scene.ev100, state.settings, limitsOf(camera, lens, state.settings.focalMm));
    return { ...r, stabilisation: r.stabilisation && hasStabilisation };
  }, [scene.ev100, state.settings, camera, lens, hasStabilisation]);
  const meter = meterReading(scene.ev100, {
    aperture: resolved.aperture, shutter: resolved.shutter, iso: resolved.iso,
    ndStops: resolved.ndStops, evComp: resolved.evComp,
  });
  const dof = depthOfField(resolved.focalMm, resolved.aperture, resolved.focusDistM, sensor);
  // A kit zoom cannot open as wide once it is zoomed in, so the aperture
  // control's range follows the focal length.
  const widestAperture = maxApertureAt(lens, resolved.focalMm);
  const gearLimits = useMemo(() => ({
    widestAperture,
    narrowestAperture: lens.minAperture,
    longestShutter: camera.mechShutterMin,
    shortestShutter: 1 / Math.max(camera.mechShutterMax, camera.eShutterMax),
    minIso: camera.isoExtMin,
    maxIso: camera.isoExtMax,
    ...(camera.flashSync > 0 ? { flashSyncShutter: 1 / camera.flashSync } : {}),
  }), [widestAperture, lens, camera]);

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
    const moved = [
      prev.aperture !== cur.aperture && `${formatAperture(prev.aperture)} → ${formatAperture(cur.aperture)}`,
      prev.shutter !== cur.shutter && `${formatShutter(prev.shutter)} → ${formatShutter(cur.shutter)}`,
      prev.iso !== cur.iso && `ISO ${prev.iso} → ${cur.iso}`,
    ].filter(Boolean);
    if (moved.length >= 2 && Math.abs(stops) < 0.2 && prev.focalMm === cur.focalMm) {
      // A "same brightness, different picture" trade was applied.
      setChangeMsg(`${t('sameLightApplied')} ${moved.join(', ')}. ${t('undoToCompare')}`);
      prevRef.current = cur;
      return;
    }
    if (prev.focalMm !== cur.focalMm) {
      what = `${prev.focalMm}mm → ${cur.focalMm}mm`;
      consequence = prev.aperture !== cur.aperture
        // The aperture moved on its own because this zoom cannot stay as
        // wide once it is zoomed in — the thing that puzzles every beginner
        // with a kit lens.
        ? `This zoom cannot open past ${formatAperture(cur.aperture)} at ${cur.focalMm}mm, so the aperture closed from ${formatAperture(prev.aperture)} by itself.`
        : cur.focalMm > prev.focalMm
          ? 'Narrower view, background looks closer and depth of field is shallower.'
          : 'Wider view, more of the scene fits in and depth of field is deeper.';
    } else if (prev.aperture !== cur.aperture) {
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
    } else if (prev.whiteBalance !== cur.whiteBalance || (cur.whiteBalance === 'custom' && prev.wbKelvin !== cur.wbKelvin)) {
      const label = (wb: ExposureSettings) => (wb.whiteBalance === 'custom' ? `${wb.wbKelvin}K` : t(WB_KEYS[wb.whiteBalance]));
      const before = whiteBalanceShift(scene.light, cameraWhiteBalance(prev.whiteBalance, prev.wbKelvin, scene.light)).mired;
      const after = whiteBalanceShift(scene.light, cameraWhiteBalance(cur.whiteBalance, cur.wbKelvin, scene.light)).mired;
      setChangeMsg(`${t('whiteBalance')} ${label(prev)} → ${label(cur)}: ${
        castKind(after) === 'neutral' ? t('wbNeutral')
          : after > before ? 'colours shift warmer (more orange).' : 'colours shift cooler (more blue).'}`);
      prevRef.current = cur;
      return;
    }
    if (what) setChangeMsg(`${what} ${describeStopChange(stops)}. ${consequence}`);
    prevRef.current = cur;
  }, [state.settings, scene.light, t]);

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

  const exposurePanel = (
    <section className="panel sim-controls" aria-labelledby="sim-exposure-title">
      <h2 id="sim-exposure-title" className="panel-title">{t('panelExposure')}</h2>
      {allowed('mode') && !video && (
        <div className="control-row mode-row">
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
          <label className="check">
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
          <p className="panel-note">{t('angleRule')}</p>
        </>
      )}

      {allowed('aperture') && (
        <ControlWithLock name="aperture" lockedList={state.lockedControls}>
          <SliderRow
            label={t('aperture')}
            values={APERTURES.filter((a) => a >= widestAperture - 1e-9 && a <= lens.minAperture)}
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
      {(allowed('focal') || allowed('focus')) && <h3 className="panel-subtitle">{t('panelLensFocus')}</h3>}
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
    </section>
  );

  const lightPanel = (
    <section className="panel sim-side" aria-labelledby="sim-light-title">
      <h2 id="sim-light-title" className="panel-title">{t('panelLight')}</h2>
      <div className="panel-block">
        <h3 className="panel-subtitle">{t('meter')}</h3>
        <Meter reading={meter} />
      </div>
      {hist && (
        <div className="panel-block">
          <h3 className="panel-subtitle">{t('histogram')}</h3>
          <Histogram data={hist} />
        </div>
      )}
      {(allowed('wb') || allowed('advanced')) && (
        <WhiteBalanceControl
          value={state.settings.whiteBalance}
          kelvin={state.settings.wbKelvin}
          light={scene.light}
          onChange={update}
        />
      )}
      {allowed('advanced') && (
        <details className="panel-more">
          <summary>{t('moreSettings')}</summary>
          <div className="panel-more-body">
            <label className="field">
              <span>{t('ndFilter')}</span>
              <select value={state.settings.ndStops} onChange={(e) => update({ ndStops: Number(e.target.value) })}>
                <option value={0}>—</option>
                <option value={3}>ND8 (3 {t('stops')})</option>
                <option value={6}>ND64 (6 {t('stops')})</option>
                <option value={10}>ND1000 (10 {t('stops')})</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={hasStabilisation && state.settings.stabilisation}
                disabled={!hasStabilisation}
                onChange={(e) => update({ stabilisation: e.target.checked })}
              />
              {t('stabilisation')}{hasStabilisation ? '' : ` — ${t('notOnThisGear')}`}
            </label>
            <label className="check">
              <input type="checkbox" checked={state.settings.flash} onChange={(e) => update({ flash: e.target.checked })} disabled={camera.flashSync === 0} />
              {t('flash')}
            </label>
          </div>
        </details>
      )}
    </section>
  );

  return (
    <div className="sim">
      <div className="sim-layout">
        <div className="sim-centre">
          <div className="sim-toolbar">
            <label htmlFor="scene-select" className="sim-toolbar-label">{t('scene')}</label>
            <select
              id="scene-select"
              data-testid="scene-select"
              value={state.sceneId}
              onChange={(e) => dispatch({ type: 'set-scene', id: e.target.value, applyStart: true })}
            >
              {scenes.map((s) => <option key={s.id} value={s.id}>{pick(s)}</option>)}
            </select>
            <div className="sim-toolbar-actions">
              <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'undo' })} aria-label={t('undo')} title={t('undo')}>↶</button>
              <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'redo' })} aria-label={t('redo')} title={t('redo')}>↷</button>
              <button type="button" className="icon-btn text" onClick={() => dispatch({ type: 'reset-exposure' })}>{t('resetExposure')}</button>
            </div>
          </div>

          <div className="sim-frame">
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
            <div className="vf-readout">
              <span data-testid="readout-aperture">{formatAperture(resolved.aperture)}</span>
              <span data-testid="readout-shutter">{formatShutter(resolved.shutter)}</span>
              <span data-testid="readout-iso">ISO {resolved.iso}</span>
              {video && <span>{fps} fps · {formatAngle(Math.round(angleFromShutter(resolved.shutter, fps)))}</span>}
              <span>{equivalentFocal(resolved.focalMm, sensor).toFixed(0)}mm eq.</span>
              <span>DoF {dof.totalM === Infinity ? '∞' : `${dof.totalM.toFixed(2)}m`}</span>
            </div>
          </div>

          <div className="shutter-bar">
            <button
              type="button"
              className="shutter-btn"
              data-testid="shutter-button"
              aria-label={t('takePhoto')}
              onClick={() => void doCapture()}
            />
            <span className="shutter-caption" aria-hidden="true">{t('takePhoto')}</span>
          </div>

          <p className="change-toast" role="status" aria-live="polite" data-testid="change-feedback">
            {changeMsg || t('tagline')}
          </p>
        </div>

        {lightPanel}
        {exposurePanel}
      </div>

      {!compact && (
        <div className="sim-insights">
          <ExposureTriangle
            settings={resolved}
            meter={meter}
            sensor={sensor}
            noiseProfile={camera.noise}
            subjectSpeedPxPerS={scene.subjectSpeedPxPerS}
            limits={gearLimits}
            backgroundDistM={backgroundDistanceOf(scene)}
            // Ready-made trades would hand over the answer in a lesson or
            // challenge, and break the 180° rule in video, so they are only
            // offered in the free simulator.
            {...(!video && !challenge && !allowedControls ? { onApply: update } : {})}
          />
          <section className="card dof-panel" aria-labelledby="dof-panel-title">
            <h2 id="dof-panel-title" className="tri-title">{t('dofPanelTitle')}</h2>
            <p className="tri-caption">{t('dofPanelCaption')}</p>
            <DepthOfFieldDiagram
              focalMm={resolved.focalMm}
              aperture={resolved.aperture}
              focusDistM={resolved.focusDistM}
              sensor={sensor}
              subjectDistM={scene.subjectDistM}
              backgroundDistM={backgroundDistanceOf(scene)}
            />
            <p className="dof-panel-link"><Link to="/depth-of-field">{t('dofOpenLab')}</Link></p>
          </section>
        </div>
      )}

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
