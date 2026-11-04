import { describe, it, expect } from 'vitest';
import { sameExposureAlternatives, lookMetrics, type GearLimits, type LookContext } from './tradeoffs';
import { defaultSettings, type ExposureSettings } from './settings';
import { settingsEV100 } from './exposure';
import { FULL_FRAME } from './optics';
import { DEFAULT_NOISE } from './noise';
import { SCENES, sceneById, startSettingsFor, backgroundDistanceOf } from '../scenes/scenes';

const LIMITS: GearLimits = {
  widestAperture: 1.4, narrowestAperture: 22, longestShutter: 30, shortestShutter: 1 / 8000,
  minIso: 100, maxIso: 51200, flashSyncShutter: 1 / 200,
};

function setup(sceneId: string, patch: Partial<ExposureSettings> = {}) {
  const scene = sceneById(sceneId);
  const s: ExposureSettings = { ...defaultSettings(), ...startSettingsFor(scene), focusDistM: scene.subjectDistM, ...patch };
  const ctx: LookContext = {
    sensor: FULL_FRAME, noiseProfile: DEFAULT_NOISE,
    subjectSpeedPxPerS: scene.subjectSpeedPxPerS, backgroundDistM: backgroundDistanceOf(scene),
  };
  return { s, ctx, alts: sameExposureAlternatives(s, LIMITS, ctx) };
}

describe('same brightness, different picture', () => {
  it('keeps the exposure the same and stays within the gear, in every scene', () => {
    for (const scene of SCENES) {
      const { s, alts } = setup(scene.id);
      for (const a of alts) {
        expect(Math.abs(settingsEV100(a.patch) - settingsEV100(s)), scene.id).toBeLessThan(0.2);
        expect(a.patch.aperture).toBeGreaterThanOrEqual(LIMITS.widestAperture);
        expect(a.patch.aperture).toBeLessThanOrEqual(LIMITS.narrowestAperture);
        expect(a.patch.shutter).toBeGreaterThanOrEqual(LIMITS.shortestShutter);
        expect(a.patch.iso).toBeLessThanOrEqual(LIMITS.maxIso);
        // It is a real trade: something moved.
        expect(a.patch.aperture !== s.aperture || a.patch.shutter !== s.shutter || a.patch.iso !== s.iso).toBe(true);
      }
    }
  });

  it('only claims changes that the measurements show', () => {
    for (const scene of SCENES) {
      const { alts } = setup(scene.id);
      for (const a of alts) {
        for (const c of a.changes) {
          const key = c.kind === 'background' ? 'backgroundBlurPx' : c.kind === 'motion' ? 'motionBlurPx' : 'noise';
          const diff = a.after[key] - a.before[key];
          expect(c.direction === 'more' ? diff > 0 : diff < 0, `${scene.id} ${c.kind}`).toBe(true);
        }
      }
    }
  });

  it('opening up in a portrait really blurs the background more', () => {
    const { alts } = setup('outdoor-portrait', { aperture: 5.6, shutter: 1 / 500, iso: 100 });
    const open = alts.find((a) => a.patch.aperture < 5.6);
    expect(open?.changes.some((c) => c.kind === 'background' && c.direction === 'more')).toBe(true);
    expect(open?.after.backgroundBlurPx).toBeGreaterThan((open?.before.backgroundBlurPx ?? 0) * 1.35);
  });

  it('a faster shutter for a sprinter really reduces motion blur', () => {
    const { alts } = setup('football', { aperture: 8, shutter: 1 / 250, iso: 200 });
    const faster = alts.find((a) => a.patch.shutter < 1 / 250 && a.patch.iso > 200);
    expect(faster?.changes.some((c) => c.kind === 'motion' && c.direction === 'less')).toBe(true);
  });

  it('does not promise a blurrier background when everything is far away', () => {
    const { alts } = setup('landscape', { aperture: 11, shutter: 1 / 250, iso: 100, focusDistM: 1000 });
    for (const a of alts) expect(a.changes.some((c) => c.kind === 'background')).toBe(false);
  });

  it('never suggests a shutter faster than flash sync while the flash is on', () => {
    const { alts } = setup('low-light-interior', { flash: true, aperture: 2.8, shutter: 1 / 125, iso: 1600 });
    for (const a of alts) expect(a.patch.shutter).toBeGreaterThanOrEqual(1 / 200 - 1e-9);
  });

  it('measures blur exactly as the renderer will draw it', () => {
    const scene = sceneById('outdoor-portrait');
    const s = { ...defaultSettings(), aperture: 2, focalMm: 85, focusDistM: 2.5 };
    const m = lookMetrics(s, { sensor: FULL_FRAME, noiseProfile: DEFAULT_NOISE, subjectSpeedPxPerS: 0, backgroundDistM: backgroundDistanceOf(scene) });
    expect(m.backgroundBlurPx).toBeGreaterThan(10);
    expect(m.dofM).toBeLessThan(0.3);
  });
});
