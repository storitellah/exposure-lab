import { describe, it, expect } from 'vitest';
import {
  relativeExposure, stopDifference, settingsEV100, stopsFromCorrect,
  meterReading, solveShutter, solveAperture, solveIso, describeStopChange,
} from './exposure';
import {
  cropFactor, equivalentFocal, fieldOfViewDeg, depthOfField, hyperfocalM,
  blurCircleMm, shakeAmount, FULL_FRAME, type SensorFormat,
} from './optics';
import { shutterFromAngle, angleFromShutter, naturalShutter, motionCadence } from './video';
import { noiseAmount, dynamicRangeStops } from './noise';
import { APERTURES, SHUTTERS, ISOS, nearest, step, formatShutter, formatAperture, defaultSettings } from './settings';
import { resolveExposure, GENERIC_LIMITS } from './autoexposure';

const APS_C: SensorFormat = { name: 'APS-C', widthMm: 23.5, heightMm: 15.7 };
const MFT: SensorFormat = { name: 'MFT', widthMm: 17.3, heightMm: 13 };

describe('exposure mathematics', () => {
  it('computes relative exposure E = t·ISO/N²', () => {
    expect(relativeExposure({ aperture: 2, shutter: 1 / 100, iso: 400 })).toBeCloseTo((0.01 * 400) / 4);
  });

  it('one stop of shutter doubles exposure', () => {
    const a = relativeExposure({ aperture: 4, shutter: 1 / 60, iso: 100 });
    const b = relativeExposure({ aperture: 4, shutter: 1 / 125, iso: 100 });
    expect(stopDifference(a, b)).toBeCloseTo(Math.log2(125 / 60), 5);
  });

  it('aperture change: f/8 → f/4 adds two stops', () => {
    const before = relativeExposure({ aperture: 8, shutter: 1 / 125, iso: 100 });
    const after = relativeExposure({ aperture: 4, shutter: 1 / 125, iso: 100 });
    expect(stopDifference(after, before)).toBeCloseTo(2, 5);
  });

  it('ISO change: 200 → 800 adds two stops', () => {
    const before = relativeExposure({ aperture: 4, shutter: 1 / 125, iso: 200 });
    const after = relativeExposure({ aperture: 4, shutter: 1 / 125, iso: 800 });
    expect(stopDifference(after, before)).toBeCloseTo(2, 5);
  });

  it('sunny-16 style sanity: EV15 scene meters correctly at f/16 1/100 ISO100', () => {
    const ev = settingsEV100({ aperture: 16, shutter: 1 / 100, iso: 100 });
    expect(ev).toBeCloseTo(Math.log2(256 * 100), 1);
    expect(Math.abs(stopsFromCorrect(14.6, { aperture: 16, shutter: 1 / 100, iso: 100 }))).toBeLessThan(0.1);
  });

  it('ND filters remove light', () => {
    const clean = stopsFromCorrect(12, { aperture: 4, shutter: 1 / 60, iso: 100 });
    const nd3 = stopsFromCorrect(12, { aperture: 4, shutter: 1 / 60, iso: 100, ndStops: 3 });
    expect(clean - nd3).toBeCloseTo(3, 5);
  });

  it('exposure compensation shifts the meter reading', () => {
    const base = meterReading(12, { aperture: 4, shutter: 1 / 60, iso: 100 });
    const comp = meterReading(12, { aperture: 4, shutter: 1 / 60, iso: 100, evComp: 1 });
    expect(base - comp).toBeCloseTo(1, 5);
  });

  it('solvers invert the exposure equation', () => {
    const ev = 12;
    const t = solveShutter(ev, 5.6, 400);
    expect(Math.abs(stopsFromCorrect(ev, { aperture: 5.6, shutter: t, iso: 400 }))).toBeLessThan(0.01);
    const n = solveAperture(ev, 1 / 125, 400);
    expect(Math.abs(stopsFromCorrect(ev, { aperture: n, shutter: 1 / 125, iso: 400 }))).toBeLessThan(0.01);
    const iso = solveIso(ev, 5.6, 1 / 125);
    expect(Math.abs(stopsFromCorrect(ev, { aperture: 5.6, shutter: 1 / 125, iso }))).toBeLessThan(0.01);
  });

  it('describes stop changes in plain language', () => {
    expect(describeStopChange(2)).toContain('added 2 stops');
    expect(describeStopChange(-1)).toContain('removed 1 stop');
    expect(describeStopChange(0.05)).toContain('about the same');
  });
});

describe('optics', () => {
  it('computes crop factors', () => {
    expect(cropFactor(FULL_FRAME)).toBeCloseTo(1, 3);
    expect(cropFactor(APS_C)).toBeCloseTo(1.53, 1);
    expect(cropFactor(MFT)).toBeCloseTo(2, 1);
  });

  it('computes equivalent focal length', () => {
    expect(equivalentFocal(25, MFT)).toBeCloseTo(50, 0);
  });

  it('computes field of view (50mm full frame ≈ 39.6° horizontal)', () => {
    expect(fieldOfViewDeg(50, FULL_FRAME)).toBeCloseTo(39.6, 0);
  });

  it('wider aperture gives shallower depth of field', () => {
    const wide = depthOfField(85, 1.8, 3, FULL_FRAME);
    const narrow = depthOfField(85, 11, 3, FULL_FRAME);
    expect(wide.totalM).toBeLessThan(narrow.totalM);
    expect(wide.nearM).toBeLessThan(3);
    expect(wide.farM).toBeGreaterThan(3);
  });

  it('focus beyond hyperfocal reaches infinity', () => {
    const h = hyperfocalM(24, 11, FULL_FRAME);
    const dof = depthOfField(24, 11, h * 1.5, FULL_FRAME);
    expect(dof.farM).toBe(Infinity);
  });

  it('background blur grows with distance behind the subject', () => {
    const near = blurCircleMm(50, 2, 2, 3);
    const far = blurCircleMm(50, 2, 2, 30);
    expect(far).toBeGreaterThan(near);
    expect(blurCircleMm(50, 2, 2, 2)).toBeCloseTo(0, 5);
  });

  it('stabilisation reduces shake', () => {
    expect(shakeAmount(1 / 10, 100, FULL_FRAME, true)).toBeLessThan(shakeAmount(1 / 10, 100, FULL_FRAME, false));
    expect(shakeAmount(1 / 500, 50, FULL_FRAME, false)).toBe(0);
  });
});

describe('video / shutter angle', () => {
  it('exposure time = angle / (360 × fps)', () => {
    expect(shutterFromAngle(180, 24)).toBeCloseTo(1 / 48, 6);
    expect(shutterFromAngle(180, 60)).toBeCloseTo(1 / 120, 6);
    expect(shutterFromAngle(360, 25)).toBeCloseTo(1 / 25, 6);
  });

  it('round-trips angle and shutter', () => {
    expect(angleFromShutter(1 / 48, 24)).toBeCloseTo(180, 4);
    expect(naturalShutter(30)).toBeCloseTo(1 / 60, 6);
  });

  it('cadence: 180° natural, small angles staccato, large smeared', () => {
    expect(motionCadence(1 / 48, 24)).toBeCloseTo(0.5, 2);
    expect(motionCadence(1 / 1000, 24)).toBeLessThan(0.4);
    expect(motionCadence(1 / 25, 24)).toBeGreaterThan(0.5);
  });
});

describe('noise model', () => {
  it('rises monotonically with ISO', () => {
    expect(noiseAmount(100)).toBeLessThan(noiseAmount(3200));
    expect(noiseAmount(3200)).toBeLessThan(noiseAmount(51200));
  });
  it('dynamic range shrinks with ISO', () => {
    expect(dynamicRangeStops(100)).toBeGreaterThan(dynamicRangeStops(12800));
  });
});

describe('setting tables', () => {
  it('finds nearest values on a log scale', () => {
    expect(nearest(APERTURES, 5.4)).toBe(5.6);
    expect(nearest(ISOS, 900)).toBe(1000);
    expect(nearest(SHUTTERS, 1 / 130)).toBe(1 / 125);
  });
  it('steps with clamping', () => {
    expect(step(APERTURES, 1.0, -1)).toBe(1.0);
    expect(step(APERTURES, 22, 1)).toBe(22);
  });
  it('formats shutter and aperture', () => {
    expect(formatShutter(1 / 125)).toBe('1/125');
    expect(formatShutter(2)).toBe('2s');
    expect(formatAperture(5.6)).toBe('f/5.6');
    expect(formatAperture(8)).toBe('f/8');
  });
});

describe('auto exposure', () => {
  it('aperture priority solves the shutter', () => {
    const s = { ...defaultSettings(), mode: 'A' as const, aperture: 2.8, iso: 100 };
    const out = resolveExposure(13, s, GENERIC_LIMITS);
    expect(Math.abs(meterReading(13, { aperture: out.aperture, shutter: out.shutter, iso: out.iso }))).toBeLessThan(0.34);
  });
  it('shutter priority solves the aperture', () => {
    const s = { ...defaultSettings(), mode: 'S' as const, shutter: 1 / 500, iso: 400 };
    const out = resolveExposure(13, s, GENERIC_LIMITS);
    expect(Math.abs(meterReading(13, { aperture: out.aperture, shutter: out.shutter, iso: out.iso }))).toBeLessThan(0.5);
  });
  it('auto ISO rescues manual settings in the dark', () => {
    const s = { ...defaultSettings(), mode: 'M' as const, aperture: 2.8, shutter: 1 / 125, iso: 100, autoIso: true };
    const out = resolveExposure(6, s, GENERIC_LIMITS);
    expect(out.iso).toBeGreaterThan(100);
    expect(Math.abs(meterReading(6, { aperture: out.aperture, shutter: out.shutter, iso: out.iso }))).toBeLessThan(0.34);
  });
  it('respects camera limits', () => {
    const s = { ...defaultSettings(), mode: 'A' as const, aperture: 1.8, iso: 100, autoIso: false };
    const out = resolveExposure(-2, s, GENERIC_LIMITS); // absurdly dark
    expect(out.shutter).toBeLessThanOrEqual(GENERIC_LIMITS.minShutter);
  });
});
