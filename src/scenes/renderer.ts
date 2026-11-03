/**
 * Scene renderer: composites a scene's layers with the visual consequences
 * of the current exposure settings — brightness, depth-of-field blur,
 * motion blur, camera shake, light trails, ISO noise, white balance,
 * vignetting and diffraction.
 *
 * Uses Canvas 2D everywhere. `ctx.filter` is used when supported, with a
 * downscale/upscale approximation as a fallback for browsers without it.
 */
import { REF_W, REF_H } from './primitives';
import type { SceneDef, SceneLayer } from './scenes';
import { photoLayers } from './photos';
import { brightnessMultiplier, stopsFromCorrect } from '../engine/exposure';
import { blurCircleMm, diffractionSoftness, shakeAmount, type SensorFormat } from '../engine/optics';
import { noiseAmount, colourNoiseAmount, detailRetention } from '../engine/noise';
import type { ExposureSettings } from '../engine/settings';
import type { NoiseProfile } from '../engine/noise';

export type Quality = 'low' | 'medium' | 'high';

export interface RenderOptions {
  scene: SceneDef;
  settings: ExposureSettings;      // resolved settings (after auto modes)
  sensor: SensorFormat;
  noiseProfile: NoiseProfile;
  quality: Quality;
  vignetting?: 'low' | 'medium' | 'high';
  /** Fixed noise seed for captured stills so results are reproducible. */
  seed?: number;
}

const QUALITY_W: Record<Quality, number> = { low: 480, medium: 800, high: 1200 };

interface LayerCache { canvases: HTMLCanvasElement[]; key: string; width: number }
let cache: LayerCache | null = null;

const supportsFilter = (() => {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas').getContext('2d');
  return !!c && 'filter' in c;
})();

/** The layers to draw: the scene's photos once loaded, otherwise its drawing. */
export function activeLayers(scene: SceneDef): { layers: SceneLayer[]; photo: boolean } {
  const photo = photoLayers(scene);
  return photo ? { layers: photo, photo: true } : { layers: scene.layers, photo: false };
}

function layerCanvases(scene: SceneDef, layers: SceneLayer[], photo: boolean, width: number): HTMLCanvasElement[] {
  const key = `${scene.id}:${photo ? 'photo' : 'drawn'}`;
  if (cache && cache.key === key && cache.width === width) return cache.canvases;
  blurCache = []; // base layers changed, so any blurred copies are stale
  const height = Math.round((width * REF_H) / REF_W);
  const canvases = layers.map((layer) => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.scale(width / REF_W, width / REF_W);
      layer.draw(ctx);
    }
    return c;
  });
  cache = { canvases, key, width };
  return canvases;
}

/**
 * Defocus blur.
 *
 * A full-resolution Gaussian blur costs roughly pixels × radius, which is by
 * far the most expensive thing this renderer does. Because a blur is a
 * low-pass filter, blurring a downscaled copy and scaling it back up is
 * visually equivalent for large radii and dramatically cheaper — and it also
 * serves as the fallback where `ctx.filter` is unavailable, since the
 * downscale/upscale alone approximates the same softening.
 */
function renderBlur(input: HTMLCanvasElement, radius: number, padEdges = false): HTMLCanvasElement {
  // An opaque, full-frame layer would otherwise blur towards transparent at
  // the frame edges. Extend it with a stretched copy of itself first and
  // crop back afterwards, so the edges stay solid.
  let src = input;
  const pad = padEdges ? Math.ceil(radius * 2) : 0;
  if (pad > 0) {
    const padded = document.createElement('canvas');
    padded.width = input.width + pad * 2;
    padded.height = input.height + pad * 2;
    const pctx = padded.getContext('2d');
    if (pctx) {
      pctx.drawImage(input, 0, 0, padded.width, padded.height);
      pctx.drawImage(input, pad, pad);
      src = padded;
    }
  }
  const blurred = blurCanvas(src, radius);
  if (src === input) return blurred;
  const out = document.createElement('canvas');
  out.width = input.width;
  out.height = input.height;
  const octx = out.getContext('2d');
  if (!octx) return blurred;
  const sx = (blurred.width - input.width) / 2;
  const sy = (blurred.height - input.height) / 2;
  octx.drawImage(blurred, sx, sy, input.width, input.height, 0, 0, input.width, input.height);
  return out;
}

function blurCanvas(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const downscale = radius > 6 ? Math.min(5, radius / 3) : 1;
  const w = Math.max(8, Math.round(src.width / downscale));
  const h = Math.max(8, Math.round(src.height / downscale));

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return src;
  tctx.imageSmoothingEnabled = true;
  if (supportsFilter) tctx.filter = `blur(${(radius / downscale).toFixed(2)}px)`;
  tctx.drawImage(src, 0, 0, w, h);

  if (downscale === 1 && supportsFilter) return tmp;

  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const octx = out.getContext('2d');
  if (!octx) return tmp;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(tmp, 0, 0, out.width, out.height);
  return out;
}

/**
 * One cached blurred copy per layer. Most re-renders (changing ISO, shutter,
 * white balance, or simply re-rendering) leave defocus untouched, so this
 * turns the dominant cost into a cache hit while staying bounded in memory.
 */
interface BlurEntry { bucket: number; canvas: HTMLCanvasElement }
let blurCache: (BlurEntry | undefined)[] = [];

function blurredLayer(index: number, src: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  // The backmost layer always fills the frame, so pad its edges when blurring.
  if (blurPx < 0.6) return src;
  // Half-pixel buckets: finer steps are invisible but would thrash the cache.
  const bucket = Math.round(blurPx * 2) / 2;
  const hit = blurCache[index];
  if (hit && hit.bucket === bucket && hit.canvas.width === src.width) return hit.canvas;
  const canvas = renderBlur(src, bucket, index === 0);
  blurCache[index] = { bucket, canvas };
  return canvas;
}

const WB_TINT: Record<ExposureSettings['whiteBalance'], [number, number, number]> = {
  auto: [0, 0, 0],
  daylight: [0, 0, 0],
  cloudy: [14, 4, -10],
  shade: [22, 6, -16],
  tungsten: [-18, -4, 26],
  fluorescent: [-6, 10, -4],
  flash: [8, 2, -6],
};

let noiseTile: HTMLCanvasElement | null = null;
function getNoiseTile(seed: number): HTMLCanvasElement {
  if (noiseTile && seed === 1) return noiseTile;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    let s = seed >>> 0 || 1;
    for (let i = 0; i < img.data.length; i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const v = s % 256;
      img.data[i] = v;
      img.data[i + 1] = (v + ((s >> 8) % 40)) & 255;
      img.data[i + 2] = (v + ((s >> 16) % 40)) & 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (seed === 1) noiseTile = c;
  return c;
}

/** Renders the simulated image into `target` and returns analysis info. */
export function renderScene(target: HTMLCanvasElement, o: RenderOptions): void {
  const width = QUALITY_W[o.quality];
  const height = Math.round((width * REF_H) / REF_W);
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return;

  const s = o.settings;
  const stopsOff = stopsFromCorrect(o.scene.ev100, {
    aperture: s.aperture, shutter: s.shutter, iso: s.iso, ndStops: s.ndStops,
  });
  const bright = brightnessMultiplier(Math.max(-6, Math.min(6, stopsOff)));
  const scale = width / REF_W;

  const active = activeLayers(o.scene);
  const layers = layerCanvases(o.scene, active.layers, active.photo, width);
  const shake = shakeAmount(s.shutter, s.focalMm, o.sensor, s.stabilisation);
  const diffraction = diffractionSoftness(s.aperture, o.sensor) * 6;
  const detail = detailRetention(s.iso, o.noiseProfile);
  const motionSamples = o.quality === 'high' ? 14 : o.quality === 'medium' ? 9 : 5;

  ctx.clearRect(0, 0, width, height);

  active.layers.forEach((layer, i) => {
    const src = layers[i];
    if (!src) return;
    // Defocus blur from the depth-of-field model, plus diffraction and
    // noise-reduction softening. Blur circle mm → screen px (empirical scale).
    const defocusMm = blurCircleMm(s.focalMm, s.aperture, s.focusDistM, layer.distanceM);
    let blurPx = Math.min(38, defocusMm * 28) * scale * 0.6 + diffraction * scale * 0.15;
    blurPx += (1 - detail) * 1.2 * scale;

    // Motion blur: subject movement plus camera shake over the exposure time.
    const motionX = layer.speed.x * s.shutter * scale;
    const motionY = layer.speed.y * s.shutter * scale;
    const shakePx = Math.min(26, shake * 5) * scale * 0.4;
    const totalMotion = Math.hypot(motionX, motionY) + shakePx;

    const drawable = blurredLayer(i, src, Math.min(30, blurPx));

    if (totalMotion > 1.5) {
      // Light-emitting layers streak into trails on long exposures.
      const samples = layer.lights && s.shutter > 0.1 ? motionSamples * 2 : motionSamples;
      const stepX = (motionX + (Math.random() - 0.5) * shakePx) / samples;
      const stepY = (motionY + (Math.random() - 0.5) * shakePx * 0.6) / samples;
      ctx.save();
      ctx.globalAlpha = Math.max(0.08, 1 / samples) * (layer.lights ? 1.6 : 1.15);
      if (ctx.globalAlpha > 1) ctx.globalAlpha = 1;
      for (let k = 0; k < samples; k++) {
        ctx.drawImage(drawable, -motionX / 2 + stepX * k, -motionY / 2 + stepY * k, width, height);
      }
      ctx.restore();
    } else {
      ctx.drawImage(drawable, 0, 0, width, height);
    }
  });

  // Exposure: multiply for darkening, additive white for over-exposure bloom.
  if (bright < 0.999) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const v = Math.round(Math.max(0, Math.min(1, bright)) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (bright > 1.001) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const over = Math.min(1, (bright - 1) / 6);
    ctx.fillStyle = `rgba(255,255,255,${(over * 0.9).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Flash: lifts near subjects in dim scenes (simple centre-weighted lift).
  if (s.flash && o.scene.ev100 < 10) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(width / 2, height * 0.6, 10, width / 2, height * 0.6, width * 0.55);
    g.addColorStop(0, 'rgba(255,250,240,0.35)');
    g.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // White balance tint.
  const tint = WB_TINT[s.whiteBalance];
  if (tint[0] || tint[1] || tint[2]) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = `rgb(${128 + tint[0]},${128 + tint[1]},${128 + tint[2]})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // ISO noise: luminance + colour noise tiles.
  const lum = noiseAmount(s.iso, o.noiseProfile);
  if (lum > 0.015) {
    const tile = getNoiseTile(o.seed ?? 1);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(0.85, lum);
    for (let y = 0; y < height; y += tile.height) {
      for (let x = 0; x < width; x += tile.width) ctx.drawImage(tile, x, y);
    }
    const chroma = colourNoiseAmount(s.iso, o.noiseProfile);
    if (chroma > 0.25) {
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = Math.min(0.25, (chroma - 0.25) * 0.5);
      for (let y = 0; y < height; y += tile.height) {
        for (let x = 0; x < width; x += tile.width) ctx.drawImage(tile, x + 31, y + 17);
      }
    }
    ctx.restore();
  }

  // Lens vignetting, stronger wide open.
  const vigLevel = o.vignetting === 'high' ? 0.5 : o.vignetting === 'medium' ? 0.3 : 0.16;
  const wideOpenFactor = Math.max(0.15, 1.4 - Math.log2(s.aperture));
  const vig = Math.min(0.6, vigLevel * wideOpenFactor);
  if (vig > 0.04) {
    const g = ctx.createRadialGradient(width / 2, height / 2, width * 0.35, width / 2, height / 2, width * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${vig.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}

/** 64-bin luminance histogram (0 = black) with clipping ratios. */
export interface HistogramData {
  bins: number[];
  clippedHighlights: number; // 0..1 share of near-white pixels
  crushedShadows: number;    // 0..1 share of near-black pixels
}

export function computeHistogram(canvas: HTMLCanvasElement): HistogramData {
  const sample = document.createElement('canvas');
  const sw = 96;
  const sh = Math.max(1, Math.round((canvas.height / canvas.width) * sw));
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  const bins = new Array<number>(64).fill(0);
  if (!sctx) return { bins, clippedHighlights: 0, crushedShadows: 0 };
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  let clipped = 0;
  let crushed = 0;
  const total = sw * sh;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    const bin = Math.min(63, Math.floor((lum / 256) * 64));
    bins[bin] = (bins[bin] ?? 0) + 1;
    if (lum > 250) clipped++;
    if (lum < 5) crushed++;
  }
  return { bins, clippedHighlights: clipped / total, crushedShadows: crushed / total };
}

/** Reset the cached layers and blurred copies (used when the scene changes). */
export function invalidateSceneCache(): void {
  cache = null;
  blurCache = [];
}
