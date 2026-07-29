/**
 * Auto-exposure solver for A / S / P modes and Auto ISO.
 * The solver picks real values from the third-stop tables, honouring
 * exposure compensation and the camera's own limits.
 */
import { APERTURES, SHUTTERS, ISOS, nearest, type ExposureSettings } from './settings';
import { solveShutter, solveAperture, solveIso } from './exposure';

export interface CameraLimits {
  minIso: number;
  maxIso: number;
  minShutter: number; // longest time, e.g. 30
  maxShutter: number; // shortest time, e.g. 1/8000
  minAperture: number; // widest available on the lens, e.g. 1.8
  maxAperture: number; // narrowest, e.g. 22
}

export const GENERIC_LIMITS: CameraLimits = {
  minIso: 100, maxIso: 51200, minShutter: 30, maxShutter: 1 / 8000,
  minAperture: 1.8, maxAperture: 22,
};

function clampTable(table: number[], value: number, lo: number, hi: number): number {
  const min = Math.min(lo, hi);
  const max = Math.max(lo, hi);
  const clamped = Math.min(max, Math.max(min, value));
  const filtered = table.filter((v) => v >= min - 1e-9 && v <= max + 1e-9);
  return nearest(filtered.length ? filtered : table, clamped);
}

/**
 * Returns the settings the camera would actually use for the selected mode.
 * Manual mode returns the user's values unchanged (Auto ISO still applies).
 */
export function resolveExposure(
  sceneEV100: number,
  s: ExposureSettings,
  limits: CameraLimits = GENERIC_LIMITS,
): ExposureSettings {
  const out = { ...s };
  const ec = s.evComp;
  const nd = s.ndStops;

  if (s.mode === 'A') {
    const ideal = solveShutter(sceneEV100, s.aperture, s.iso, ec, nd);
    out.shutter = clampTable(SHUTTERS, ideal, limits.minShutter, limits.maxShutter);
  } else if (s.mode === 'S') {
    const ideal = solveAperture(sceneEV100, s.shutter, s.iso, ec, nd);
    out.aperture = clampTable(APERTURES, ideal, limits.minAperture, limits.maxAperture);
  } else if (s.mode === 'P') {
    // Program: balanced pair — start from f/5.6 and solve the shutter,
    // then open up if the shutter would be dangerously slow.
    let ap = clampTable(APERTURES, 5.6, limits.minAperture, limits.maxAperture);
    let sh = solveShutter(sceneEV100, ap, s.iso, ec, nd);
    while (sh > 1 / 60 && ap > limits.minAperture) {
      const next = clampTable(APERTURES, ap / 1.4, limits.minAperture, limits.maxAperture);
      if (next === ap) break;
      ap = next;
      sh = solveShutter(sceneEV100, ap, s.iso, ec, nd);
    }
    out.aperture = ap;
    out.shutter = clampTable(SHUTTERS, sh, limits.minShutter, limits.maxShutter);
  }

  if (s.autoIso) {
    const ideal = solveIso(sceneEV100, out.aperture, out.shutter, ec, nd);
    out.iso = clampTable(ISOS, ideal, limits.minIso, limits.maxIso);
  }
  return out;
}
