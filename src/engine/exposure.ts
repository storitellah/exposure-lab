/**
 * Exposure mathematics.
 *
 * Relative exposure:  E = t × ISO / N²
 * Stop difference:    stops = log2(E_current / E_reference)
 *
 * A scene has a light level expressed as EV at ISO 100 (EV100).
 * Camera settings meter to EV_settings = log2(N²/t) − log2(ISO/100).
 * The image is correctly exposed when EV_settings equals the scene EV100.
 * stopsOff > 0 means the image is brighter than the metered ideal.
 */

export interface ExposureInput {
  aperture: number;   // f-number N
  shutter: number;    // seconds t
  iso: number;
  ndStops?: number;   // light removed by an ND filter, in stops
  evComp?: number;    // shifts the metered target, in stops
}

/** Relative exposure E = t × ISO / N². Larger means more light recorded. */
export function relativeExposure(i: ExposureInput): number {
  return (i.shutter * i.iso) / (i.aperture * i.aperture) / Math.pow(2, i.ndStops ?? 0);
}

/** Stop difference between two relative exposures. */
export function stopDifference(current: number, reference: number): number {
  return Math.log2(current / reference);
}

/** EV of the settings normalised to ISO 100. */
export function settingsEV100(i: ExposureInput): number {
  const evBase = Math.log2((i.aperture * i.aperture) / i.shutter);
  return evBase - Math.log2(i.iso / 100) + (i.ndStops ?? 0);
}

/**
 * How many stops away from a correct exposure the settings are for a scene.
 * Positive = overexposed (brighter), negative = underexposed (darker).
 * Exposure compensation moves the target: +1 EC means the photographer
 * wants the image one stop brighter than the meter's ideal.
 */
export function stopsFromCorrect(sceneEV100: number, i: ExposureInput): number {
  return sceneEV100 - settingsEV100(i);
}

/**
 * Meter reading shown to the user: how far the current settings are from the
 * target the photographer asked for (ideal shifted by exposure compensation).
 */
export function meterReading(sceneEV100: number, i: ExposureInput): number {
  return sceneEV100 - settingsEV100(i) - (i.evComp ?? 0);
}

/** Brightness multiplier applied to the rendered scene for a stop offset. */
export function brightnessMultiplier(stopsOff: number): number {
  return Math.pow(2, stopsOff);
}

/**
 * Solve one variable so the exposure meters to sceneEV100 + evComp.
 * Returns the ideal (unclamped, off-table) value.
 */
export function solveShutter(sceneEV100: number, aperture: number, iso: number, evComp = 0, ndStops = 0): number {
  // EV_settings = log2(N²/t) − log2(ISO/100) + nd  ⇒  t = N² / 2^(EV_target + log2(ISO/100) − nd)
  const target = sceneEV100 - evComp;
  return (aperture * aperture) / Math.pow(2, target + Math.log2(iso / 100) - ndStops);
}

export function solveAperture(sceneEV100: number, shutter: number, iso: number, evComp = 0, ndStops = 0): number {
  const target = sceneEV100 - evComp;
  return Math.sqrt(shutter * Math.pow(2, target + Math.log2(iso / 100) - ndStops));
}

export function solveIso(sceneEV100: number, aperture: number, shutter: number, evComp = 0, ndStops = 0): number {
  const target = sceneEV100 - evComp;
  // log2(ISO/100) = log2(N²/t) − target + nd
  return 100 * Math.pow(2, Math.log2((aperture * aperture) / shutter) - target + ndStops);
}

/** Human sentence describing a settings change, e.g. "added 2 stops of light". */
export function describeStopChange(stops: number): string {
  const abs = Math.abs(stops);
  const rounded = Math.round(abs * 3) / 3;
  const n = rounded === Math.round(rounded) ? `${rounded}` : rounded.toFixed(1);
  if (abs < 0.16) return 'kept the exposure about the same';
  return stops > 0 ? `added ${n} stop${rounded === 1 ? '' : 's'} of light` : `removed ${n} stop${rounded === 1 ? '' : 's'} of light`;
}
