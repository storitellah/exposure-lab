/**
 * White balance.
 *
 * Every light source has a colour: candles and household bulbs are orange
 * (low Kelvin), midday sun is neutral, shade and overcast sky are blue (high
 * Kelvin). The camera's white balance setting tells it what colour of light
 * to expect and cancels it out. When the setting matches the light, whites
 * look white. When it does not, the picture takes on a colour cast:
 *
 *   light warmer than the setting  → orange/yellow cast
 *   light cooler than the setting  → blue cast
 *
 * The cast is modelled in mireds (1,000,000 / Kelvin), the unit photographic
 * filters use, because equal mired steps look like equal colour shifts.
 * Colours come from a black-body approximation, so the cast has realistic
 * hues rather than a generic tint.
 */
import type { WhiteBalance } from './settings';

/** Colour of the light in a scene. */
export interface SceneLight {
  kelvin: number;
  /** Green (+) / magenta (−) shift, e.g. fluorescent tubes ≈ +0.3. */
  tint?: number;
}

export const DEFAULT_LIGHT: SceneLight = { kelvin: 5500 };

export const KELVIN_RANGE = { min: 2500, max: 10000, step: 100 };

/** What each preset assumes about the light. */
export const WB_PRESETS: Record<Exclude<WhiteBalance, 'auto' | 'custom'>, SceneLight> = {
  tungsten: { kelvin: 3200 },
  fluorescent: { kelvin: 4000, tint: 0.3 },
  daylight: { kelvin: 5500 },
  flash: { kelvin: 5500 },
  cloudy: { kelvin: 6500 },
  shade: { kelvin: 7500 },
};

export const mired = (kelvin: number): number => 1e6 / kelvin;

/**
 * Auto white balance, as most cameras behave: it neutralises ordinary light
 * fully, but deliberately keeps part of the glow of very warm light (candles,
 * tungsten) and of very blue shade, because fully neutral versions of those
 * scenes look unnatural. It also removes most, not all, of a green tint.
 */
export function autoWhiteBalance(light: SceneLight): SceneLight {
  let k = light.kelvin;
  if (k < 4000) k = k + (4000 - k) * 0.35;
  else if (k > 7500) k = k - (k - 7500) * 0.3;
  return { kelvin: k, tint: (light.tint ?? 0) * 0.7 };
}

/** The light the camera is set to expect. */
export function cameraWhiteBalance(wb: WhiteBalance, customKelvin: number, light: SceneLight): SceneLight {
  if (wb === 'auto') return autoWhiteBalance(light);
  if (wb === 'custom') return { kelvin: clampKelvin(customKelvin) };
  return WB_PRESETS[wb];
}

export function clampKelvin(k: number): number {
  if (!Number.isFinite(k)) return DEFAULT_LIGHT.kelvin;
  return Math.min(KELVIN_RANGE.max, Math.max(KELVIN_RANGE.min, k));
}

/**
 * Approximate sRGB colour (0–1 per channel) of a black body at `kelvin`
 * (Tanner Helland's fit to the CIE data, good from 1000 K to 40000 K).
 */
export function blackbodyRgb(kelvin: number): [number, number, number] {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.min(255, Math.max(1, v)) / 255;
  return [c(r), c(g), c(b)];
}

export interface WhiteBalanceResult {
  /** Positive = warmer (orange) than neutral, negative = cooler (blue). */
  mired: number;
  /** Positive = greener, negative = more magenta. */
  tint: number;
  /** Per-channel multipliers to apply to a neutrally balanced image. */
  gains: [number, number, number];
  /** Kelvin the camera is set to expect (after auto WB). */
  cameraKelvin: number;
}

/**
 * How a neutrally balanced image changes when shot under `light` with the
 * camera set to `camera`. Gains keep overall brightness about the same.
 */
export function whiteBalanceShift(light: SceneLight, camera: SceneLight): WhiteBalanceResult {
  const lit = blackbodyRgb(light.kelvin);
  const assumed = blackbodyRgb(camera.kelvin);
  const tint = (light.tint ?? 0) - (camera.tint ?? 0);
  let gains: [number, number, number] = [lit[0] / assumed[0], lit[1] / assumed[1], lit[2] / assumed[2]];
  gains = [gains[0], gains[1] * (1 + tint * 0.35), gains[2]];
  // Normalise to unchanged luminance so a cast never reads as an exposure change.
  const luma = 0.2126 * gains[0] + 0.7152 * gains[1] + 0.0722 * gains[2];
  gains = [gains[0] / luma, gains[1] / luma, gains[2] / luma];
  return { mired: mired(light.kelvin) - mired(camera.kelvin), tint, gains, cameraKelvin: camera.kelvin };
}

export type CastKind = 'neutral' | 'warm' | 'veryWarm' | 'cool' | 'veryCool';

/** Plain-language size of the cast. ~20 mired is about where people notice. */
export function castKind(miredShift: number): CastKind {
  if (miredShift > 90) return 'veryWarm';
  if (miredShift > 20) return 'warm';
  if (miredShift < -60) return 'veryCool';
  if (miredShift < -20) return 'cool';
  return 'neutral';
}
