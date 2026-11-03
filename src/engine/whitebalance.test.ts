import { describe, it, expect } from 'vitest';
import {
  autoWhiteBalance, blackbodyRgb, cameraWhiteBalance, castKind, clampKelvin, whiteBalanceShift, WB_PRESETS,
} from './whitebalance';
import { SCENES } from '../scenes/scenes';

const shift = (lightK: number, wb: Parameters<typeof cameraWhiteBalance>[0], custom = 5500, tint = 0) =>
  whiteBalanceShift({ kelvin: lightK, tint }, cameraWhiteBalance(wb, custom, { kelvin: lightK, tint }));

describe('white balance', () => {
  it('is neutral when the setting matches the light', () => {
    expect(castKind(shift(5500, 'daylight').mired)).toBe('neutral');
    expect(castKind(shift(3200, 'tungsten').mired)).toBe('neutral');
    expect(castKind(shift(7500, 'shade').mired)).toBe('neutral');
    expect(castKind(shift(3300, 'custom', 3300).mired)).toBe('neutral');
  });

  it('turns orange when the light is warmer than the setting', () => {
    const s = shift(3200, 'daylight');
    expect(s.mired).toBeGreaterThan(90);
    expect(castKind(s.mired)).toBe('veryWarm');
    expect(s.gains[0]).toBeGreaterThan(1);
    expect(s.gains[2]).toBeLessThan(1);
  });

  it('turns blue when the light is cooler than the setting', () => {
    const s = shift(5500, 'tungsten');
    expect(castKind(s.mired)).toBe('veryCool');
    expect(s.gains[2]).toBeGreaterThan(1);
    expect(s.gains[0]).toBeLessThan(1);
  });

  it('keeps overall brightness: a cast is not an exposure change', () => {
    for (const [lightK, wb] of [[3200, 'daylight'], [5500, 'tungsten'], [7500, 'daylight']] as const) {
      const [r, g, b] = shift(lightK, wb).gains;
      expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(1, 5);
    }
  });

  it('auto neutralises daylight but keeps some warmth under bulbs, like real cameras', () => {
    expect(castKind(shift(5500, 'auto').mired)).toBe('neutral');
    expect(castKind(shift(6500, 'auto').mired)).toBe('neutral');
    expect(autoWhiteBalance({ kelvin: 2800 }).kelvin).toBeGreaterThan(2800);
    expect(shift(2800, 'auto').mired).toBeGreaterThan(20);
  });

  it('removes the green of fluorescent tubes only with the fluorescent setting', () => {
    expect(shift(4000, 'fluorescent', 5500, 0.3).tint).toBeCloseTo(0, 5);
    expect(shift(4000, 'custom', 4000, 0.3).tint).toBeCloseTo(0.3, 5);
    expect(WB_PRESETS.fluorescent.tint).toBeGreaterThan(0);
  });

  it('clamps custom Kelvin and models black-body colour sensibly', () => {
    expect(clampKelvin(100)).toBe(2500);
    expect(clampKelvin(99999)).toBe(10000);
    expect(clampKelvin(Number.NaN)).toBe(5500);
    const warm = blackbodyRgb(2700);
    const cool = blackbodyRgb(9000);
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThan(cool[0]);
  });

  it('every scene declares a plausible light colour', () => {
    for (const scene of SCENES) {
      expect(scene.light.kelvin, scene.id).toBeGreaterThanOrEqual(2500);
      expect(scene.light.kelvin, scene.id).toBeLessThanOrEqual(10000);
    }
  });
});
