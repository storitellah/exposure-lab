/**
 * Capture pipeline: freeze the simulated scene at full quality, produce a
 * JPEG blob plus a thumbnail, and hand it to the gallery. Exported images
 * contain no EXIF, GPS or personal metadata (canvas encoding strips all).
 */
import { renderScene, type RenderOptions } from '../scenes/renderer';
import { saveShot, type StoredShot } from '../state/db';
import type { ExposureSettings } from '../engine/settings';
import type { ScoreBreakdown } from '../engine/scoring';

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), type, quality);
  });
}

export interface CaptureResult {
  blob: Blob;
  thumb: Blob;
  dataUrl: string;
}

/** Render at high quality with a fixed seed so the capture is reproducible. */
export async function captureScene(options: Omit<RenderOptions, 'quality' | 'seed'>): Promise<CaptureResult> {
  const canvas = document.createElement('canvas');
  renderScene(canvas, { ...options, quality: 'high', seed: 7 });

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);

  const thumbCanvas = document.createElement('canvas');
  const tw = 320;
  thumbCanvas.width = tw;
  thumbCanvas.height = Math.round((canvas.height / canvas.width) * tw);
  const tctx = thumbCanvas.getContext('2d');
  if (tctx) tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumb = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.8);

  return { blob, thumb, dataUrl: canvas.toDataURL('image/jpeg', 0.9) };
}

export interface KeepShotArgs {
  capture: CaptureResult;
  sceneId: string;
  cameraId: string;
  lensId: string;
  settings: ExposureSettings;
  meter: number;
  challengeId?: string;
  score?: ScoreBreakdown;
  reflection?: string;
}

export async function keepShot(args: KeepShotArgs): Promise<StoredShot> {
  const shot: StoredShot = {
    id: `shot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    createdAt: Date.now(),
    sceneId: args.sceneId,
    cameraId: args.cameraId,
    lensId: args.lensId,
    settings: args.settings,
    meter: args.meter,
    favourite: false,
    reflection: args.reflection ?? '',
    blob: args.capture.blob,
    thumb: args.capture.thumb,
    ...(args.challengeId !== undefined ? { challengeId: args.challengeId } : {}),
    ...(args.score !== undefined ? { score: args.score } : {}),
  };
  await saveShot(shot);
  return shot;
}

/** Trigger a local download; the object URL is revoked after use. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
