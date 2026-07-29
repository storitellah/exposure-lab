/**
 * Optics: sensor formats, crop factor, field of view and depth of field.
 *
 * Depth of field model:
 *   circle of confusion  c = sensor diagonal / 1500
 *   hyperfocal distance  H = f² / (N·c) + f
 *   near limit           Dn = s·(H − f) / (H + s − 2f)
 *   far limit            Df = s·(H − f) / (H − s)   (∞ when s ≥ H)
 * with f = focal length, N = f-number, s = focus distance (all in metres
 * internally; focal length converted from millimetres).
 */

export interface SensorFormat {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const FULL_FRAME: SensorFormat = { name: 'Full frame', widthMm: 36, heightMm: 24 };

export function sensorDiagonalMm(s: SensorFormat): number {
  return Math.hypot(s.widthMm, s.heightMm);
}

/** Crop factor relative to full frame (43.27 mm diagonal). */
export function cropFactor(s: SensorFormat): number {
  return sensorDiagonalMm(FULL_FRAME) / sensorDiagonalMm(s);
}

/** Full-frame equivalent focal length. */
export function equivalentFocal(focalMm: number, s: SensorFormat): number {
  return focalMm * cropFactor(s);
}

/** Horizontal field of view in degrees. */
export function fieldOfViewDeg(focalMm: number, s: SensorFormat): number {
  return (2 * Math.atan(s.widthMm / (2 * focalMm)) * 180) / Math.PI;
}

/** Circle of confusion in millimetres (diagonal / 1500 convention). */
export function circleOfConfusionMm(s: SensorFormat): number {
  return sensorDiagonalMm(s) / 1500;
}

/** Hyperfocal distance in metres. */
export function hyperfocalM(focalMm: number, aperture: number, s: SensorFormat): number {
  const f = focalMm / 1000;
  const c = circleOfConfusionMm(s) / 1000;
  return (f * f) / (aperture * c) + f;
}

export interface DofResult {
  nearM: number;
  farM: number;          // Infinity when beyond the hyperfocal distance
  totalM: number;        // Infinity when farM is Infinity
  hyperfocalM: number;
}

export function depthOfField(
  focalMm: number,
  aperture: number,
  focusDistM: number,
  sensor: SensorFormat,
): DofResult {
  const f = focalMm / 1000;
  const H = hyperfocalM(focalMm, aperture, sensor);
  const s = Math.max(focusDistM, f * 1.05); // cannot focus inside the lens
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return {
    nearM: near,
    farM: far,
    totalM: far === Infinity ? Infinity : far - near,
    hyperfocalM: H,
  };
}

/**
 * Approximate diameter of the blur circle (in millimetres on the sensor) for
 * an object at distance d when focused at s:  b = (f²/(N·s)) · |d − s| / d
 */
export function blurCircleMm(
  focalMm: number,
  aperture: number,
  focusDistM: number,
  objectDistM: number,
): number {
  const f = focalMm / 1000;
  const s = Math.max(focusDistM, f * 1.05);
  const d = Math.max(objectDistM, 0.01);
  return ((f * f) / (aperture * (s - f))) * (Math.abs(d - s) / d) * 1000;
}

/** Diffraction softening becomes visible past roughly f/11 on small sensors. */
export function diffractionSoftness(aperture: number, sensor: SensorFormat): number {
  const limit = 11 * (sensorDiagonalMm(sensor) / sensorDiagonalMm(FULL_FRAME));
  if (aperture <= limit) return 0;
  return Math.min(1, Math.log2(aperture / limit) * 0.6);
}

/**
 * Handheld shake in stops of blur risk. The classic guide is a minimum
 * shutter of 1/(equivalent focal length). Stabilisation buys ~4 stops.
 */
export function shakeAmount(
  shutterS: number,
  focalMm: number,
  sensor: SensorFormat,
  stabilised: boolean,
): number {
  const safe = 1 / equivalentFocal(focalMm, sensor);
  const stopsOver = Math.log2(shutterS / safe) - (stabilised ? 4 : 0);
  return Math.max(0, stopsOver);
}
