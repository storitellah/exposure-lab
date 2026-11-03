import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeFilename, parseChallengeUrl, buildChallengeUrl } from './sanitize';
import { scoreChallenge, subjectBlurPx } from './scoring';
import { defaultSettings } from './settings';
import { FULL_FRAME, equivalentFocal } from './optics';
import { PRINT_FORMATS, printableAreaMm, fitImageToPage } from './printsizes';
import {
  CAMERAS, LENSES, checkCompatibility, cameraById, lensById, limitsOf,
  sensorOf, maxApertureAt, isVariableAperture, isFixedMount, preferredLensFor,
} from '../data/catalogue';
import { GLOSSARY, CATEGORY_LABELS } from '../data/glossary';
import { CHALLENGES, CHALLENGE_IDS } from '../data/challenges';
import { LESSONS } from '../data/lessons';
import { SCENES, SCENE_IDS, sceneById, startSettingsFor } from '../scenes/scenes';
import { meterReading } from './exposure';

describe('input sanitisation', () => {
  it('strips angle brackets and control characters', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeText('hello\x00\x1fworld')).toBe('hello world');
  });
  it('caps length and collapses whitespace', () => {
    expect(sanitizeText('a'.repeat(500)).length).toBe(280);
    expect(sanitizeText('  a   b  ')).toBe('a b');
  });
  it('rejects non-strings', () => {
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText(null)).toBe('');
  });
  it('produces safe filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('My Photo!.jpg')).toBe('My-Photojpg');
    expect(sanitizeFilename('')).toBe('photo');
  });
});

describe('challenge URL parsing', () => {
  const challenges = CHALLENGE_IDS;
  const scenes = SCENE_IDS;

  it('round-trips a valid state', () => {
    const qs = buildChallengeUrl({ challengeId: 'freeze-footballer', sceneId: 'football', aperture: 2.8, locked: ['iso'] });
    const parsed = parseChallengeUrl(qs, challenges, scenes);
    expect(parsed).not.toBeNull();
    expect(parsed?.challengeId).toBe('freeze-footballer');
    expect(parsed?.aperture).toBe(2.8);
    expect(parsed?.locked).toEqual(['iso']);
  });

  it('rejects unknown ids', () => {
    expect(parseChallengeUrl('c=evil&sc=football', challenges, scenes)).toBeNull();
    expect(parseChallengeUrl('c=freeze-footballer&sc=nope', challenges, scenes)).toBeNull();
  });

  it('rejects script injection and oversized input', () => {
    expect(parseChallengeUrl('c=<script>&sc=football', challenges, scenes)).toBeNull();
    expect(parseChallengeUrl(`c=freeze-footballer&sc=football&x=${'a'.repeat(600)}`, challenges, scenes)).toBeNull();
  });

  it('drops out-of-range numbers but keeps the challenge', () => {
    const parsed = parseChallengeUrl('c=freeze-footballer&sc=football&a=9999&i=50', challenges, scenes);
    expect(parsed).not.toBeNull();
    expect(parsed?.aperture).toBeUndefined();
    expect(parsed?.iso).toBe(50);
  });

  it('ignores unknown lock values', () => {
    const parsed = parseChallengeUrl('c=freeze-footballer&sc=football&lock=iso,evil', challenges, scenes);
    expect(parsed?.locked).toEqual(['iso']);
  });
});

describe('challenge scoring', () => {
  const ctx = { sceneEV100: 14, subjectSpeedPxPerS: 420, sensor: FULL_FRAME };

  it('rewards a frozen, well-exposed action shot', () => {
    const s = { ...defaultSettings(), aperture: 4, shutter: 1 / 1000, iso: 100 };
    const score = scoreChallenge({ motion: { maxBlurPx: 4 } }, s, ctx);
    expect(score.motion).toBeGreaterThan(90);
    expect(score.total).toBeGreaterThan(75);
  });

  it('punishes motion blur when freezing is the goal', () => {
    const s = { ...defaultSettings(), aperture: 16, shutter: 1 / 30, iso: 100 };
    const score = scoreChallenge({ motion: { maxBlurPx: 4 } }, s, ctx);
    expect(score.motion).toBeLessThan(50);
  });

  it('accepts multiple valid answers (no single correct exposure)', () => {
    const a = { ...defaultSettings(), aperture: 2.8, shutter: 1 / 2000, iso: 100 };
    const b = { ...defaultSettings(), aperture: 4, shutter: 1 / 1000, iso: 100 };
    const goal = { motion: { maxBlurPx: 4 } };
    expect(scoreChallenge(goal, a, ctx).total).toBeGreaterThan(70);
    expect(scoreChallenge(goal, b, ctx).total).toBeGreaterThan(70);
  });

  it('scores shallow depth of field goals', () => {
    const shallow = { ...defaultSettings(), aperture: 1.8, focusDistM: 2.5, focalMm: 85 };
    const deep = { ...defaultSettings(), aperture: 16, focusDistM: 2.5, focalMm: 24 };
    const goal = { dof: { maxTotalM: 1.2 } };
    const sctx = { ...ctx, subjectSpeedPxPerS: 0 };
    expect(scoreChallenge(goal, shallow, sctx).dof).toBeGreaterThan(scoreChallenge(goal, deep, sctx).dof);
  });

  it('computes subject blur from speed and shutter', () => {
    expect(subjectBlurPx(400, 1 / 100)).toBe(4);
  });
});

describe('print dimensions', () => {
  it('has all required formats', () => {
    const ids = PRINT_FORMATS.map((f) => f.id);
    for (const id of ['a4-portrait', 'a4-landscape', 'letter-portrait', 'letter-landscape', 'a5', 'print-4x6', 'print-5x7', 'print-8x10', 'square', 'postcard', 'contact-sheet']) {
      expect(ids).toContain(id);
    }
  });
  it('computes printable areas inside margins', () => {
    const a4 = PRINT_FORMATS[0]!;
    const area = printableAreaMm(a4);
    expect(area.widthMm).toBe(210 - 24);
    expect(area.heightMm).toBe(297 - 24);
  });
  it('fits images preserving aspect ratio', () => {
    const a4 = PRINT_FORMATS[0]!;
    const fit = fitImageToPage(1200, 750, a4);
    expect(fit.widthMm / fit.heightMm).toBeCloseTo(1200 / 750, 3);
    expect(fit.widthMm).toBeLessThanOrEqual(printableAreaMm(a4).widthMm + 0.01);
  });
});

describe('camera & lens catalogue', () => {
  it('contains all required camera manufacturers', () => {
    const makers = new Set(CAMERAS.map((c) => c.manufacturer));
    for (const m of ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic LUMIX', 'OM SYSTEM', 'Olympus', 'Leica', 'Sigma', 'Hasselblad', 'Phase One', 'Samsung', 'Pentax', 'Kodak', 'YI', 'Zeiss', 'Ricoh', 'Blackmagic Design', 'RED', 'Z CAM', 'Kinefinity', 'DJI']) {
      expect(makers, `missing ${m}`).toContain(m);
    }
  });

  it('every camera profile has consistent data', () => {
    for (const cam of CAMERAS) {
      expect(cam.sensorWidthMm).toBeGreaterThan(0);
      expect(cam.isoMax).toBeGreaterThanOrEqual(cam.isoMin);
      expect(cam.isoExtMax).toBeGreaterThanOrEqual(cam.isoMax);
      expect(cam.cropFactor).toBeGreaterThan(0.3);
    }
  });

  it('native mounts are compatible', () => {
    expect(checkCompatibility(lensById('canon-rf50-18'), cameraById('canon-r6ii')).status).toBe('native');
    expect(checkCompatibility(lensById('nikkor-z85'), cameraById('nikon-z8')).status).toBe('native');
  });

  it('cross-mount without adapter is incompatible', () => {
    expect(checkCompatibility(lensById('nikkor-z85'), cameraById('canon-r6ii')).status).toBe('incompatible');
    expect(checkCompatibility(lensById('fujinon-xf3514'), cameraById('sony-a7iv')).status).toBe('incompatible');
  });

  it('adapters bridge known combinations with limitations', () => {
    const compat = checkCompatibility(lensById('canon-tse24'), cameraById('canon-r6ii'));
    expect(compat.status).toBe('adapter');
    const pl = checkCompatibility(lensById('cooke-s4i50'), cameraById('red-komodo-x'));
    expect(pl.status).toBe('adapter');
    if (pl.status === 'adapter') expect(pl.adapter.limitations).toContain('manual-focus-only');
  });

  it('generic camera accepts every interchangeable lens', () => {
    for (const lens of LENSES.filter((l) => !isFixedMount(l.mount))) {
      expect(checkCompatibility(lens, cameraById('generic')).status).not.toBe('incompatible');
    }
  });

  it('derives sensible limits from a camera and lens pair', () => {
    const limits = limitsOf(cameraById('sony-a7iv'), lensById('generic-50'));
    expect(limits.minAperture).toBe(1.8);
    expect(limits.maxAperture).toBe(22);
    expect(limits.maxShutter).toBeLessThan(1 / 7000);
  });
});

describe('starting exposures', () => {
  it('every scene opens within a third of a stop of a correct exposure', () => {
    for (const scene of SCENES) {
      const start = startSettingsFor(scene);
      const meter = meterReading(scene.ev100, {
        aperture: start.aperture as number,
        shutter: start.shutter as number,
        iso: start.iso as number,
      });
      expect(Math.abs(meter), `${scene.id} meters ${meter.toFixed(2)}`).toBeLessThan(0.34);
    }
  });

  it('no lesson starts already solved — each one has something to fix', () => {
    for (const lesson of LESSONS) {
      const scene = sceneById(lesson.sceneId);
      const settings = {
        ...defaultSettings(),
        ...startSettingsFor(scene),
        ...(lesson.startPatch ?? {}),
      };
      const solved = lesson.check({
        settings,
        sceneEV100: scene.ev100,
        subjectSpeedPxPerS: scene.subjectSpeedPxPerS,
      });
      expect(solved, `${lesson.id} is pre-solved at its starting settings`).toBe(false);
    }
  });

  it('every lesson is solvable from its starting point', () => {
    // Each lesson must have at least one reachable settings combination that
    // passes its check, using only values from the standard tables.
    const apertures = [1.8, 2, 2.8, 4, 5.6, 8, 11, 16];
    const shutters = [1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000];
    const isos = [100, 200, 400, 800, 1600, 3200, 6400];
    for (const lesson of LESSONS) {
      const scene = sceneById(lesson.sceneId);
      const base = { ...defaultSettings(), ...startSettingsFor(scene), ...(lesson.startPatch ?? {}) };
      let solvable = false;
      outer: for (const aperture of apertures) {
        for (const shutter of shutters) {
          for (const iso of isos) {
            for (const evComp of [0, 1, 1.7]) {
              for (const whiteBalance of ['auto', 'tungsten', 'daylight', 'shade'] as const) {
                if (lesson.check({
                  settings: { ...base, aperture, shutter, iso, evComp, whiteBalance },
                  sceneEV100: scene.ev100,
                  subjectSpeedPxPerS: scene.subjectSpeedPxPerS,
                })) { solvable = true; break outer; }
              }
            }
          }
        }
      }
      expect(solvable, `${lesson.id} has no reachable solution`).toBe(true);
    }
  });
});

describe('Canon EOS R100 and its kit lens', () => {
  const r100 = cameraById('canon-r100');
  const kit = lensById('canon-rfs18-45');

  it('both are in the catalogue and paired as a kit', () => {
    expect(r100.model).toBe('EOS R100');
    expect(kit.model).toContain('18-45mm');
    expect(r100.kitLensId).toBe(kit.id);
  });

  it('the kit lens mounts natively on the R100', () => {
    expect(checkCompatibility(kit, r100).status).toBe('native');
  });

  it('is an APS-C lens, so a full-frame RF body crops rather than refusing it', () => {
    const compat = checkCompatibility(kit, cameraById('canon-r6ii'));
    expect(compat.status).toBe('adapter');
    if (compat.status === 'adapter') expect(compat.adapter.limitations).toContain('crop-mode');
  });

  it('does not mount on another manufacturer’s body', () => {
    expect(checkCompatibility(kit, cameraById('sony-a7iv')).status).toBe('incompatible');
  });

  it('frames 18-45mm as roughly 29-72mm in full-frame terms', () => {
    const sensor = sensorOf(r100);
    // Canon markets "29-72mm equivalent" from a nominal 1.6x crop; the
    // sensor's real diagonal gives 1.61x, so allow for the rounding.
    expect(equivalentFocal(kit.minFocal, sensor)).toBeCloseTo(29, 0);
    expect(equivalentFocal(kit.maxFocal, sensor)).toBeGreaterThan(71);
    expect(equivalentFocal(kit.maxFocal, sensor)).toBeLessThan(74);
  });
});

describe('Nikon Z50 II, Fujifilm bodies and Viltrox primes', () => {
  it('pairs the Z50 II with the NIKKOR Z DX 16-50mm kit lens', () => {
    const z50 = cameraById('nikon-z50ii');
    const kit = lensById('nikkor-z-dx-16-50');
    expect(z50.kitLensId).toBe(kit.id);
    expect(checkCompatibility(kit, z50).status).toBe('native');
    expect(isVariableAperture(kit)).toBe(true);
    expect(maxApertureAt(kit, 16)).toBeCloseTo(3.5, 1);
    expect(maxApertureAt(kit, 50)).toBeCloseTo(6.3, 1);
    expect(preferredLensFor(z50)).toBe(kit.id);
  });

  it('mounts both Viltrox f/1.2 primes natively on the X-T4 and X-T5', () => {
    for (const camId of ['fujifilm-xt4', 'fujifilm-xt5']) {
      const cam = cameraById(camId);
      expect(cam.suggestedLensIds).toEqual(['viltrox-27-12-xf', 'viltrox-75-12-xf']);
      for (const lensId of cam.suggestedLensIds ?? []) {
        const lens = lensById(lensId);
        expect(lens.maxAperture).toBe(1.2);
        expect(checkCompatibility(lens, cam).status).toBe('native');
      }
      expect(limitsOf(cam, lensById('viltrox-27-12-xf')).minAperture).toBe(1.2);
    }
  });

  it('keeps the Viltrox X-mount primes off other mounts', () => {
    expect(checkCompatibility(lensById('viltrox-75-12-xf'), cameraById('nikon-z50ii')).status).toBe('incompatible');
  });

  it('treats the X100VI as a fixed-lens camera', () => {
    const x100 = cameraById('fujifilm-x100vi');
    const builtIn = lensById('fujinon-x100vi-23');
    expect(isFixedMount(x100.mount)).toBe(true);
    expect(checkCompatibility(builtIn, x100).status).toBe('native');
    expect(preferredLensFor(x100)).toBe(builtIn.id);
    for (const lens of LENSES.filter((l) => l.id !== builtIn.id)) {
      expect(checkCompatibility(lens, x100).status).toBe('incompatible');
    }
    // The built-in lens cannot be moved to another body either.
    expect(checkCompatibility(builtIn, cameraById('fujifilm-xt5')).status).toBe('incompatible');
    expect(checkCompatibility(builtIn, cameraById('generic')).status).toBe('incompatible');
  });

  it('gives the Zeiss ZX1 its own built-in 35mm lens', () => {
    const zx1 = cameraById('zeiss-zx1');
    expect(preferredLensFor(zx1)).toBe('zeiss-zx1-35');
    expect(checkCompatibility(lensById('generic-50'), zx1).status).toBe('incompatible');
  });

  it('every kit and suggested lens exists and fits its camera', () => {
    for (const cam of CAMERAS) {
      for (const id of [cam.kitLensId, ...(cam.suggestedLensIds ?? [])].filter(Boolean) as string[]) {
        expect(LENSES.some((l) => l.id === id), `${cam.id} → ${id}`).toBe(true);
        expect(checkCompatibility(lensById(id), cam).status, `${cam.id} → ${id}`).not.toBe('incompatible');
      }
    }
  });
});

describe('glossary', () => {
  it('has a long list of unique, fully translated entries', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(80);
    const ids = new Set(GLOSSARY.map((e) => e.id));
    expect(ids.size).toBe(GLOSSARY.length);
    for (const e of GLOSSARY) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(CATEGORY_LABELS[e.category]).toBeDefined();
      for (const field of [e.term, e.simple, e.advanced]) {
        expect(field.en.trim().length, e.id).toBeGreaterThan(0);
        expect(field.sw.trim().length, e.id).toBeGreaterThan(0);
      }
      // The in-depth text should add something beyond the plain version.
      expect(e.advanced.en).not.toBe(e.simple.en);
    }
  });

  it('covers every topic', () => {
    for (const cat of Object.keys(CATEGORY_LABELS)) {
      expect(GLOSSARY.some((e) => e.category === cat), cat).toBe(true);
    }
  });
});

describe('variable maximum aperture', () => {
  const kit = lensById('canon-rfs18-45');

  it('opens to f/4.5 at the wide end and only f/6.3 at the long end', () => {
    expect(isVariableAperture(kit)).toBe(true);
    expect(maxApertureAt(kit, 18)).toBeCloseTo(4.5, 2);
    expect(maxApertureAt(kit, 45)).toBeCloseTo(6.3, 2);
  });

  it('narrows monotonically in between, never past either end', () => {
    let previous = 0;
    for (let f = 18; f <= 45; f++) {
      const widest = maxApertureAt(kit, f);
      expect(widest).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(widest).toBeGreaterThanOrEqual(4.5 - 1e-9);
      expect(widest).toBeLessThanOrEqual(6.3 + 1e-9);
      previous = widest;
    }
  });

  it('clamps focal lengths outside the zoom range', () => {
    expect(maxApertureAt(kit, 5)).toBeCloseTo(4.5, 2);
    expect(maxApertureAt(kit, 500)).toBeCloseTo(6.3, 2);
  });

  it('leaves primes and constant-aperture zooms alone', () => {
    const prime = lensById('canon-rf50-18');
    expect(isVariableAperture(prime)).toBe(false);
    expect(maxApertureAt(prime, 50)).toBe(prime.maxAperture);
    const constant = lensById('nikkor-z2470');
    expect(isVariableAperture(constant)).toBe(false);
    expect(maxApertureAt(constant, 70)).toBe(2.8);
  });

  it('reports the focal-dependent limit through limitsOf', () => {
    const r100 = cameraById('canon-r100');
    expect(limitsOf(r100, kit, 18).minAperture).toBeCloseTo(4.5, 2);
    expect(limitsOf(r100, kit, 45).minAperture).toBeCloseTo(6.3, 2);
    // With no focal length given, the published widest aperture is used.
    expect(limitsOf(r100, kit).minAperture).toBe(4.5);
  });

  it('every lens declaring a tele aperture really does narrow', () => {
    for (const lens of LENSES) {
      if (lens.maxApertureTele === undefined) continue;
      expect(lens.maxApertureTele, lens.id).toBeGreaterThan(lens.maxAperture);
      expect(lens.type, lens.id).toBe('zoom');
    }
  });
});

describe('content data', () => {
  it('has 13 lessons with bilingual text and valid scenes', () => {
    expect(LESSONS.length).toBe(13);
    for (const lesson of LESSONS) {
      expect(SCENE_IDS.has(lesson.sceneId), `scene ${lesson.sceneId}`).toBe(true);
      expect(lesson.title.sw.length).toBeGreaterThan(0);
    }
  });
  it('has 12 challenges pointing at valid scenes', () => {
    expect(CHALLENGES.length).toBe(12);
    for (const c of CHALLENGES) expect(SCENE_IDS.has(c.sceneId)).toBe(true);
  });
  it('has all 23 required scenes', () => {
    expect(SCENES.length).toBe(23);
  });
});
