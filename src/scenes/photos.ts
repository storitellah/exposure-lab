/**
 * Photographic scene layers.
 *
 * A photo scene is a background plate (the photo with its subject removed
 * and the gap filled) plus full-frame cut-outs with transparency. The plate
 * is split into horizontal depth bands, far at the top to near at the
 * bottom, so the ground softens progressively with distance instead of the
 * whole background blurring as one flat card. Each band and cut-out becomes
 * an ordinary SceneLayer, so depth of field, motion blur, light trails and
 * every other effect in the renderer apply to photos exactly as they do to
 * the drawn scenes.
 *
 * Images load lazily per scene; until they have decoded (or if they fail),
 * the renderer keeps using the scene's drawn layers.
 */
import { REF_W, REF_H, type Ctx } from './primitives';
import type { PhotoScene, SceneDef, SceneLayer } from './scenes';

/** Height of the soft transition between depth bands, as a share of frame height. */
export const BAND_FEATHER = 0.06;

export type PhotoLayerSpec =
  | { kind: 'band'; src: string; fromY: number; distanceM: number; lights: boolean }
  | { kind: 'cutout'; src: string; distanceM: number; speed: { x: number; y: number }; lights: boolean };

/**
 * Pure layer plan, back to front: plate bands top-down (each covering from
 * its edge to the bottom of the frame, so stacking them leaves no gaps), then
 * cut-outs from farthest to nearest. Cut-outs always sit in front of the
 * plate: a subject standing on the ground hides the ground behind it.
 */
export function planPhotoLayers(photo: PhotoScene): PhotoLayerSpec[] {
  const bands = [...photo.bands].sort((a, b) => a.fromY - b.fromY);
  const plate: PhotoLayerSpec[] = bands.map((b, i) => ({
    kind: 'band',
    src: photo.plate,
    fromY: i === 0 ? 0 : Math.min(1, Math.max(0, b.fromY)),
    distanceM: b.distanceM,
    lights: !!photo.plateLights,
  }));
  const cutouts: PhotoLayerSpec[] = [...photo.cutouts]
    .sort((a, b) => b.distanceM - a.distanceM)
    .map((c) => ({ kind: 'cutout', src: c.src, distanceM: c.distanceM, speed: c.speed, lights: !!c.lights }));
  return [...plate, ...cutouts];
}

/** Every image file a photo scene needs. */
export function photoSources(photo: PhotoScene): string[] {
  return [photo.plate, ...photo.cutouts.map((c) => c.src)];
}

const images = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const done = images.get(src);
  if (done) return Promise.resolve(done);
  let p = loading.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const finish = () => { images.set(src, img); resolve(img); };
        // decode() keeps the first draw from stalling the main thread.
        if (typeof img.decode === 'function') img.decode().then(finish, finish);
        else finish();
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }).finally(() => loading.delete(src));
    loading.set(src, p);
  }
  return p;
}

/** True once every image of the scene's photo version has decoded. */
export function photoReady(scene: SceneDef): boolean {
  return !!scene.photo && photoSources(scene.photo).every((s) => images.has(s));
}

/**
 * Load a scene's photos. Resolves true when they are ready to draw, false if
 * the scene has none or any file failed (the drawn version is then used).
 */
export async function loadScenePhotos(scene: SceneDef): Promise<boolean> {
  if (!scene.photo || typeof Image === 'undefined') return false;
  const loaded = await Promise.all(photoSources(scene.photo).map(loadImage));
  return loaded.every((img) => img !== null);
}

function drawBand(ctx: Ctx, img: HTMLImageElement, fromY: number): void {
  ctx.drawImage(img, 0, 0, REF_W, REF_H);
  if (fromY <= 0) return;
  // Keep only the part of the plate below this band's edge, with a soft edge.
  const y0 = Math.max(0, fromY - BAND_FEATHER / 2) * REF_H;
  const y1 = Math.min(1, fromY + BAND_FEATHER / 2) * REF_H;
  const g = ctx.createLinearGradient(0, y0, 0, Math.max(y0 + 1, y1));
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, REF_W, REF_H);
  ctx.restore();
}

const built = new Map<string, SceneLayer[]>();

/** The scene's photographic layers, or null while they are unavailable. */
export function photoLayers(scene: SceneDef): SceneLayer[] | null {
  if (!scene.photo || !photoReady(scene)) return null;
  const hit = built.get(scene.id);
  if (hit) return hit;
  const layers = planPhotoLayers(scene.photo).map((spec): SceneLayer => {
    const img = images.get(spec.src) as HTMLImageElement;
    return spec.kind === 'band'
      ? { distanceM: spec.distanceM, speed: { x: 0, y: 0 }, lights: spec.lights, draw: (c) => drawBand(c, img, spec.fromY) }
      : { distanceM: spec.distanceM, speed: spec.speed, lights: spec.lights, draw: (c) => c.drawImage(img, 0, 0, REF_W, REF_H) };
  });
  built.set(scene.id, layers);
  return layers;
}
