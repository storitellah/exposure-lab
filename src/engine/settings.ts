/**
 * Standard third-stop tables and helpers for camera settings.
 * These tables are the single source of truth for selectable values.
 */

export const APERTURES: number[] = [
  1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.2, 3.5, 4.0, 4.5, 5.0,
  5.6, 6.3, 7.1, 8.0, 9.0, 10, 11, 13, 14, 16, 18, 20, 22,
];

/** Shutter speeds in seconds, long to short (third stops). */
export const SHUTTERS: number[] = [
  30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1,
  1 / 1.3, 1 / 1.6, 1 / 2, 1 / 2.5, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8,
  1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60,
  1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400,
  1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000,
  1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000,
];

export const ISOS: number[] = [
  50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250,
  1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000,
  25600, 32000, 40000, 51200, 64000, 80000, 102400, 128000, 160000, 204800,
];

export const EV_COMP_RANGE = { min: -5, max: 5, step: 1 / 3 };

export type ShootMode = 'M' | 'A' | 'S' | 'P';
export type WhiteBalance =
  | 'auto' | 'daylight' | 'cloudy' | 'shade' | 'tungsten' | 'fluorescent' | 'flash' | 'custom';

export interface ExposureSettings {
  aperture: number;      // f-number
  shutter: number;       // seconds
  iso: number;
  evComp: number;        // stops of exposure compensation
  focalMm: number;       // lens focal length in millimetres
  focusDistM: number;    // focus distance in metres
  mode: ShootMode;
  autoIso: boolean;
  whiteBalance: WhiteBalance;
  /** Colour temperature used when whiteBalance is 'custom'. */
  wbKelvin: number;
  stabilisation: boolean;
  ndStops: number;       // neutral density filter strength in stops (0 = none)
  flash: boolean;
  focusPoint: { x: number; y: number }; // normalised 0..1 within the frame
}

export function defaultSettings(): ExposureSettings {
  return {
    aperture: 5.6,
    shutter: 1 / 125,
    iso: 400,
    evComp: 0,
    focalMm: 50,
    focusDistM: 3,
    mode: 'M',
    autoIso: false,
    whiteBalance: 'auto',
    wbKelvin: 5500,
    stabilisation: true,
    ndStops: 0,
    flash: false,
    focusPoint: { x: 0.5, y: 0.45 },
  };
}

/** Find the closest value in a table. */
export function nearest(table: number[], value: number): number {
  let best = table[0] ?? value;
  let bestDiff = Infinity;
  for (const v of table) {
    const d = Math.abs(Math.log2(v) - Math.log2(value));
    if (d < bestDiff) { bestDiff = d; best = v; }
  }
  return best;
}

/** Step through a table by a number of positions (clamped). */
export function step(table: number[], current: number, steps: number): number {
  const idx = table.indexOf(nearest(table, current));
  const next = Math.min(table.length - 1, Math.max(0, idx + steps));
  return table[next] ?? current;
}

/** Format a shutter time such as 0.008 → "1/125" or 2 → "2s". */
export function formatShutter(seconds: number): string {
  if (seconds >= 1) {
    return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
  }
  const denom = 1 / seconds;
  const rounded = denom >= 100 ? Math.round(denom / 5) * 5 : Math.round(denom * 10) / 10;
  return `1/${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

export function formatAperture(f: number): string {
  return `f/${f % 1 === 0 ? f.toFixed(0) : f.toFixed(1)}`;
}
