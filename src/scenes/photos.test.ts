import { describe, it, expect } from 'vitest';
import { planPhotoLayers, photoSources } from './photos';
import { SCENES, type PhotoScene } from './scenes';

// Every photo file shipped in public/scenes (keys are '/public/scenes/…').
const SHIPPED = new Set(
  Object.keys(import.meta.glob('/public/scenes/**/*.webp')).map((k) => k.replace(/^\/public/, '')),
);

const sample: PhotoScene = {
  plate: '/scenes/x/plate.webp',
  bands: [
    { fromY: 0.8, distanceM: 3 },
    { fromY: 0, distanceM: 2000 },
    { fromY: 0.55, distanceM: 30 },
  ],
  cutouts: [
    { src: '/scenes/x/cutout-1.webp', distanceM: 2.5, speed: { x: 0, y: 0 } },
    { src: '/scenes/x/cutout-2.webp', distanceM: 15, speed: { x: -35, y: 0 } },
  ],
};

describe('photo scene layers', () => {
  it('orders the plate bands far to near, then cut-outs far to near', () => {
    const plan = planPhotoLayers(sample);
    expect(plan.map((l) => l.distanceM)).toEqual([2000, 30, 3, 15, 2.5]);
    expect(plan.slice(0, 3).every((l) => l.kind === 'band')).toBe(true);
    expect(plan.slice(3).every((l) => l.kind === 'cutout')).toBe(true);
  });

  it('makes the first band cover the whole frame so stacking leaves no gaps', () => {
    const plan = planPhotoLayers({ ...sample, bands: [{ fromY: 0.1, distanceM: 500 }, { fromY: 0.7, distanceM: 5 }] });
    const first = plan[0];
    expect(first?.kind === 'band' && first.fromY).toBe(0);
  });

  it('keeps a moving cut-out moving', () => {
    const walker = planPhotoLayers(sample).find((l) => l.src.endsWith('cutout-2.webp'));
    expect(walker?.kind === 'cutout' && walker.speed.x).toBe(-35);
  });

  it('lists every file a scene needs', () => {
    expect(photoSources(sample)).toEqual(['/scenes/x/plate.webp', '/scenes/x/cutout-1.webp', '/scenes/x/cutout-2.webp']);
  });

  it('every photographed scene ships its files and a sensible depth plan', () => {
    for (const scene of SCENES.filter((s) => s.photo)) {
      const photo = scene.photo as PhotoScene;
      for (const src of photoSources(photo)) {
        expect(src, scene.id).toMatch(/^\/scenes\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
        expect(SHIPPED.has(src), `${scene.id}: ${src}`).toBe(true);
      }
      expect(photo.bands.length, scene.id).toBeGreaterThan(0);
      for (const b of photo.bands) {
        expect(b.fromY).toBeGreaterThanOrEqual(0);
        expect(b.fromY).toBeLessThan(1);
        expect(b.distanceM).toBeGreaterThan(0);
      }
    }
  });
});
