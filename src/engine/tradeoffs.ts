/**
 * "Same brightness, different picture".
 *
 * Moving light from one corner of the exposure triangle to another keeps the
 * exposure the same but changes how the photo looks. Rather than promise a
 * look ("blurrier background!") that may not happen in this scene, every
 * alternative is measured with the same optics the renderer uses — the
 * background's blur, the motion blur on the subject and camera shake, the
 * sharp zone and the grain — and only real, visible differences are reported.
 */
import { APERTURES, SHUTTERS, ISOS, nearest, type ExposureSettings } from './settings';
import { settingsEV100 } from './exposure';
import { blurCircleMm, depthOfField, sensorDiagonalMm, shakeAmount, FULL_FRAME, type SensorFormat } from './optics';
import { noiseAmount, type NoiseProfile } from './noise';
import { subjectBlurPx } from './scoring';

export interface GearLimits {
  widestAperture: number;
  narrowestAperture: number;
  longestShutter: number;
  shortestShutter: number;
  minIso: number;
  maxIso: number;
  /** Fastest shutter that syncs with flash, in seconds; respected when flash is on. */
  flashSyncShutter?: number;
}

export interface LookContext {
  sensor: SensorFormat;
  noiseProfile: NoiseProfile;
  subjectSpeedPxPerS: number;
  /** Distance of the main background behind the subject, in metres. */
  backgroundDistM: number;
}

export interface LookMetrics {
  /** Background blur in pixels on the 800 px reference frame (as rendered). */
  backgroundBlurPx: number;
  /** Subject motion blur plus handheld shake, in reference pixels. */
  motionBlurPx: number;
  /** Total depth of field in metres (Infinity when it reaches the horizon). */
  dofM: number;
  /** 0..1 grain amount. */
  noise: number;
}

/**
 * Background blur exactly as the renderer draws it: the blur circle on the
 * sensor, as a share of the sensor's diagonal, mapped to the reference frame.
 */
export function backgroundBlurPx(focalMm: number, aperture: number, focusDistM: number, objectDistM: number, sensor: SensorFormat): number {
  const sensorScale = sensorDiagonalMm(FULL_FRAME) / sensorDiagonalMm(sensor);
  return Math.min(38, blurCircleMm(focalMm, aperture, focusDistM, objectDistM) * 28 * sensorScale) * 0.6;
}

export function shakeBlurPx(s: Pick<ExposureSettings, 'shutter' | 'focalMm' | 'stabilisation'>, sensor: SensorFormat): number {
  return Math.min(26, shakeAmount(s.shutter, s.focalMm, sensor, s.stabilisation) * 5) * 0.4;
}

export function lookMetrics(s: ExposureSettings, ctx: LookContext): LookMetrics {
  const dof = depthOfField(s.focalMm, s.aperture, s.focusDistM, ctx.sensor);
  return {
    backgroundBlurPx: backgroundBlurPx(s.focalMm, s.aperture, s.focusDistM, ctx.backgroundDistM, ctx.sensor),
    motionBlurPx: subjectBlurPx(ctx.subjectSpeedPxPerS, s.shutter) + shakeBlurPx(s, ctx.sensor),
    dofM: dof.totalM,
    noise: noiseAmount(s.iso, ctx.noiseProfile),
  };
}

export type ChangeKind = 'background' | 'motion' | 'noise';

export interface LookChange {
  kind: ChangeKind;
  /** 'more' = more background blur / more motion blur / more grain. */
  direction: 'more' | 'less';
  before: number;
  after: number;
}

export interface Tradeoff {
  patch: Pick<ExposureSettings, 'aperture' | 'shutter' | 'iso'>;
  /** Exposure difference in stops (positive = brighter); ≈0 by construction. */
  evDelta: number;
  before: LookMetrics;
  after: LookMetrics;
  /** Differences big enough to see, most noticeable first. */
  changes: LookChange[];
}

/** Grain bands roughly where a viewer would describe the image differently. */
export function grainLevel(n: number): 0 | 1 | 2 | 3 {
  if (n < 0.08) return 0;
  if (n < 0.25) return 1;
  if (n < 0.5) return 2;
  return 3;
}

/** Is a blur change something you would actually notice? */
function blurChangeVisible(a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi < 1.2) return false;               // both effectively sharp
  return hi - lo >= 0.8 && hi / Math.max(lo, 0.3) >= 1.35;
}

export function describeChanges(before: LookMetrics, after: LookMetrics): LookChange[] {
  const out: (LookChange & { weight: number })[] = [];
  if (blurChangeVisible(before.backgroundBlurPx, after.backgroundBlurPx)) {
    out.push({
      kind: 'background', direction: after.backgroundBlurPx > before.backgroundBlurPx ? 'more' : 'less',
      before: before.backgroundBlurPx, after: after.backgroundBlurPx,
      weight: Math.abs(after.backgroundBlurPx - before.backgroundBlurPx),
    });
  }
  if (blurChangeVisible(before.motionBlurPx, after.motionBlurPx)) {
    out.push({
      kind: 'motion', direction: after.motionBlurPx > before.motionBlurPx ? 'more' : 'less',
      before: before.motionBlurPx, after: after.motionBlurPx,
      weight: Math.abs(after.motionBlurPx - before.motionBlurPx),
    });
  }
  if (grainLevel(before.noise) !== grainLevel(after.noise) || Math.abs(after.noise - before.noise) >= 0.06) {
    out.push({
      kind: 'noise', direction: after.noise > before.noise ? 'more' : 'less',
      before: before.noise, after: after.noise,
      weight: Math.abs(after.noise - before.noise) * 20,
    });
  }
  return out.sort((a, b) => b.weight - a.weight).map(({ weight: _w, ...c }) => c);
}

/** Move a value along its third-stop table; undefined if it runs off the end. */
function step(table: number[], value: number, thirds: number): number | undefined {
  const idx = table.indexOf(nearest(table, value));
  return table[idx + thirds];
}

/**
 * Up to three trades that keep the exposure the same: open the aperture and
 * speed up the shutter; close it and slow the shutter; trade shutter speed
 * for ISO. Each is tried at two stops, then one, and must stay within what
 * the gear (and flash, when on) can do. Table directions: APERTURES rises in
 * f-number (less light), SHUTTERS runs long → short (less light), ISOS rises
 * (more light).
 */
export function sameExposureAlternatives(s: ExposureSettings, lim: GearLimits, ctx: LookContext): Tradeoff[] {
  const fastest = s.flash && lim.flashSyncShutter ? Math.max(lim.shortestShutter, lim.flashSyncShutter) : lim.shortestShutter;
  const inRange = (p: Tradeoff['patch']) =>
    p.aperture >= lim.widestAperture - 1e-9 && p.aperture <= lim.narrowestAperture + 1e-9 &&
    p.shutter <= lim.longestShutter + 1e-9 && p.shutter >= fastest - 1e-12 &&
    p.iso >= lim.minIso && p.iso <= lim.maxIso;

  const before = lookMetrics(s, ctx);
  const baseEv = settingsEV100({ aperture: s.aperture, shutter: s.shutter, iso: s.iso });

  const build = (make: (thirds: number) => Partial<Tradeoff['patch']>): Tradeoff | undefined => {
    let fallback: Tradeoff | undefined;
    for (const thirds of [6, 3]) {
      const moved = make(thirds);
      if (Object.values(moved).some((v) => v === undefined)) continue;
      const patch = { aperture: s.aperture, shutter: s.shutter, iso: s.iso, ...moved };
      if (!inRange(patch)) continue;
      const after = lookMetrics({ ...s, ...patch }, ctx);
      const t: Tradeoff = {
        patch, after, before,
        evDelta: baseEv - settingsEV100(patch),
        changes: describeChanges(before, after),
      };
      if (t.changes.length > 0) return t;
      fallback ??= t;
    }
    return fallback;
  };

  const openUp = build((n) => ({ aperture: step(APERTURES, s.aperture, -n), shutter: step(SHUTTERS, s.shutter, n) }));
  const stopDown = build((n) => ({ aperture: step(APERTURES, s.aperture, n), shutter: step(SHUTTERS, s.shutter, -n) }));
  const isoTrade = s.iso <= 1600
    ? build((n) => ({ shutter: step(SHUTTERS, s.shutter, n), iso: step(ISOS, s.iso, n) }))
    : build((n) => ({ shutter: step(SHUTTERS, s.shutter, -n), iso: step(ISOS, s.iso, -n) }));

  return [openUp, stopDown, isoTrade].filter((a): a is Tradeoff => a !== undefined);
}
