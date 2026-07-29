/**
 * Challenge scoring. Photography rarely has one correct answer, so each
 * criterion accepts a range of good solutions and scores distance from it.
 */
import { meterReading } from './exposure';
import { depthOfField, shakeAmount, type SensorFormat } from './optics';
import { noiseAmount } from './noise';
import type { ExposureSettings } from './settings';

export interface ChallengeGoal {
  /** Acceptable meter range in stops, e.g. [-0.7, 0.7]. */
  exposure?: [number, number];
  /** Required max subject blur in px (freeze) or min blur (intentional blur). */
  motion?: { maxBlurPx?: number; minBlurPx?: number };
  /** Depth of field in metres: shallow portraits want small, landscapes large. */
  dof?: { maxTotalM?: number; minTotalM?: number };
  /** Focus distance must be within this many metres of the subject. */
  focus?: { subjectDistM: number; toleranceM: number };
  /** Maximum acceptable visible noise 0..1. */
  noise?: { max: number };
  /** Free-form creative check, returns 0..100. */
  creative?: (s: ExposureSettings) => number;
}

export interface ScoreBreakdown {
  exposure: number;
  motion: number;
  dof: number;
  focus: number;
  noise: number;
  creative: number;
  total: number; // 0..100 weighted
}

export interface ScoreContext {
  sceneEV100: number;
  subjectSpeedPxPerS: number; // subject movement at preview scale
  sensor: SensorFormat;
}

function rangeScore(value: number, lo: number, hi: number, falloff: number): number {
  if (value >= lo && value <= hi) return 100;
  const dist = value < lo ? lo - value : value - hi;
  return Math.max(0, 100 - (dist / falloff) * 100);
}

export function subjectBlurPx(speedPxPerS: number, shutterS: number): number {
  return speedPxPerS * shutterS;
}

export function scoreChallenge(
  goal: ChallengeGoal,
  s: ExposureSettings,
  ctx: ScoreContext,
): ScoreBreakdown {
  const parts: ScoreBreakdown = {
    exposure: 100, motion: 100, dof: 100, focus: 100, noise: 100, creative: 100, total: 0,
  };
  const weights = {
    exposure: 1, motion: 0, dof: 0, focus: 0, noise: 0.5, creative: 0,
  };

  const meter = meterReading(ctx.sceneEV100, s);
  const [lo, hi] = goal.exposure ?? [-0.7, 0.7];
  parts.exposure = rangeScore(meter, lo, hi, 2);

  if (goal.motion) {
    weights.motion = 1;
    const blur = subjectBlurPx(ctx.subjectSpeedPxPerS, s.shutter) +
      shakeAmount(s.shutter, s.focalMm, ctx.sensor, s.stabilisation) * 4;
    if (goal.motion.maxBlurPx !== undefined) {
      parts.motion = rangeScore(blur, 0, goal.motion.maxBlurPx, goal.motion.maxBlurPx * 2 + 4);
    } else if (goal.motion.minBlurPx !== undefined) {
      parts.motion = rangeScore(blur, goal.motion.minBlurPx, Infinity, goal.motion.minBlurPx);
    }
  }

  if (goal.dof) {
    weights.dof = 1;
    const dof = depthOfField(s.focalMm, s.aperture, s.focusDistM, ctx.sensor);
    const total = dof.totalM === Infinity ? 10000 : dof.totalM;
    if (goal.dof.maxTotalM !== undefined) {
      parts.dof = rangeScore(total, 0, goal.dof.maxTotalM, goal.dof.maxTotalM * 3);
    } else if (goal.dof.minTotalM !== undefined) {
      parts.dof = rangeScore(total, goal.dof.minTotalM, Infinity, goal.dof.minTotalM);
    }
  }

  if (goal.focus) {
    weights.focus = 1;
    const dof = depthOfField(s.focalMm, s.aperture, s.focusDistM, ctx.sensor);
    const d = goal.focus.subjectDistM;
    const inFocus = d >= dof.nearM && d <= dof.farM;
    const dist = Math.abs(s.focusDistM - d);
    parts.focus = inFocus ? 100 : rangeScore(dist, 0, goal.focus.toleranceM, d);
  }

  if (goal.noise) {
    parts.noise = rangeScore(noiseAmount(s.iso), 0, goal.noise.max, 0.5);
  }

  if (goal.creative) {
    weights.creative = 1;
    parts.creative = Math.max(0, Math.min(100, goal.creative(s)));
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  parts.total = Math.round(
    (parts.exposure * weights.exposure + parts.motion * (weights.motion ?? 0) +
      parts.dof * (weights.dof ?? 0) + parts.focus * (weights.focus ?? 0) +
      parts.noise * (weights.noise ?? 0) + parts.creative * (weights.creative ?? 0)) /
      totalWeight,
  );
  return parts;
}
