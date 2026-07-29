/**
 * ISO noise and dynamic-range model.
 * This is an educational approximation, not a measurement of any real camera.
 */

export interface NoiseProfile {
  /** ISO where noise becomes clearly visible for this class of sensor. */
  cleanIso: number;
  /** 0..1 multiplier: larger sensors and newer designs are cleaner. */
  strength: number;
}

export const DEFAULT_NOISE: NoiseProfile = { cleanIso: 1600, strength: 1 };

/** Visible luminance noise 0..1 for a given ISO. */
export function noiseAmount(iso: number, profile: NoiseProfile = DEFAULT_NOISE): number {
  if (iso <= profile.cleanIso) {
    return (iso / profile.cleanIso) * 0.06 * profile.strength;
  }
  const stopsOver = Math.log2(iso / profile.cleanIso);
  return Math.min(1, (0.06 + stopsOver * 0.16) * profile.strength);
}

/** Colour (chroma) noise rises faster than luminance noise at high ISO. */
export function colourNoiseAmount(iso: number, profile: NoiseProfile = DEFAULT_NOISE): number {
  return Math.min(1, noiseAmount(iso, profile) * 1.3);
}

/** Usable dynamic range in stops, shrinking as ISO climbs. */
export function dynamicRangeStops(iso: number, baseStops = 13, baseIso = 100): number {
  const stopsOver = Math.max(0, Math.log2(iso / baseIso));
  return Math.max(6, baseStops - stopsOver * 0.75);
}

/** Fine-detail retention 0..1 (noise reduction smears texture at high ISO). */
export function detailRetention(iso: number, profile: NoiseProfile = DEFAULT_NOISE): number {
  return Math.max(0.35, 1 - noiseAmount(iso, profile) * 0.7);
}
