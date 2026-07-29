/**
 * Video exposure helpers.
 *
 * Shutter angle relationship:
 *   exposure time = shutter angle / (360 × frame rate)
 * A 180° angle at 24 fps gives 1/48 s — the classic "natural motion" look.
 */

export const FRAME_RATES = [24, 25, 30, 50, 60, 120] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

export const SHUTTER_ANGLES = [11.25, 22.5, 45, 90, 172.8, 180, 270, 360] as const;

export function shutterFromAngle(angleDeg: number, fps: number): number {
  return angleDeg / (360 * fps);
}

export function angleFromShutter(shutterS: number, fps: number): number {
  return shutterS * 360 * fps;
}

/** Recommended "natural motion" shutter for a frame rate (180° rule). */
export function naturalShutter(fps: number): number {
  return shutterFromAngle(180, fps);
}

/**
 * Motion cadence score from 0 (very staccato) through 0.5 (natural)
 * to 1 (very smeared), based on the effective shutter angle.
 */
export function motionCadence(shutterS: number, fps: number): number {
  const angle = angleFromShutter(shutterS, fps);
  const clamped = Math.min(360, Math.max(1, angle));
  return Math.min(1, Math.max(0, Math.log2(clamped / 180) * 0.25 + 0.5));
}

export function formatAngle(angleDeg: number): string {
  return `${angleDeg % 1 === 0 ? angleDeg : angleDeg.toFixed(1)}°`;
}

/** Well-known pairings shown in the comparison table. */
export const CADENCE_PAIRS = [
  { fps: 24, shutter: 1 / 48, label: '24 fps · 1/48' },
  { fps: 24, shutter: 1 / 50, label: '24 fps · 1/50' },
  { fps: 25, shutter: 1 / 50, label: '25 fps · 1/50' },
  { fps: 30, shutter: 1 / 60, label: '30 fps · 1/60' },
  { fps: 50, shutter: 1 / 100, label: '50 fps · 1/100' },
  { fps: 60, shutter: 1 / 120, label: '60 fps · 1/120' },
  { fps: 120, shutter: 1 / 240, label: '120 fps · 1/240' },
];
