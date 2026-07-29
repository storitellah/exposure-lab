/**
 * Ethical sharing helpers: deterministic challenge links (no personal
 * data), Web Share API with copy/QR fallbacks, and share-card rendering.
 */
import qrcodegen from 'qrcode-generator';
import { buildChallengeUrl, type ChallengeUrlState } from '../engine/sanitize';
import { formatAperture, formatShutter, type ExposureSettings } from '../engine/settings';

export function challengeLink(state: ChallengeUrlState): string {
  const qs = buildChallengeUrl(state);
  return `${window.location.origin}/challenges?${qs}`;
}

export async function shareOrCopy(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return 'shared';
    }
  } catch {
    /* user cancelled or unsupported — fall through to copy */
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function settingsSummary(s: ExposureSettings): string {
  return `${formatAperture(s.aperture)} · ${formatShutter(s.shutter)} · ISO ${s.iso}`;
}

/** Render a QR code onto a canvas (local generation, no network). */
export function drawQr(canvas: HTMLCanvasElement, text: string, sizePx = 220): void {
  const qr = qrcodegen(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const scale = Math.floor(sizePx / (count + 8));
  const size = (count + 8) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#171717';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
    }
  }
}

export interface ShareCardArgs {
  imageUrl: string;         // data URL of the simulated photograph
  challengeTitle: string;
  settings: ExposureSettings;
  score?: number;
  badge?: string;
  learning: string;
}

/** Draw a share card (1200×630) and return it as a JPEG blob. */
export async function renderShareCard(args: ShareCardArgs): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  ctx.fillStyle = '#171717';
  ctx.fillRect(0, 0, W, H);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = args.imageUrl;
  });
  const imgW = 660;
  const imgH = Math.round((img.height / img.width) * imgW);
  ctx.drawImage(img, 40, (H - imgH) / 2, imgW, imgH);

  ctx.fillStyle = '#FBB03B';
  ctx.font = '800 44px Outfit, sans-serif';
  wrapText(ctx, args.challengeTitle, 740, 120, 420, 52);

  ctx.fillStyle = '#F3F1EC';
  ctx.font = '700 30px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText(settingsSummary(args.settings), 740, 250);

  if (args.score !== undefined) {
    ctx.fillStyle = '#2E9B62';
    ctx.font = '800 64px Outfit, sans-serif';
    ctx.fillText(`${args.score}/100`, 740, 340);
  }
  if (args.badge) {
    ctx.fillStyle = '#FBB03B';
    ctx.font = '700 26px Outfit, sans-serif';
    ctx.fillText(`★ ${args.badge}`, 740, 400);
  }

  ctx.fillStyle = '#B9B4A8';
  ctx.font = '400 22px "Atkinson Hyperlegible", sans-serif';
  wrapText(ctx, args.learning, 740, 450, 420, 30);

  ctx.fillStyle = '#F3F1EC';
  ctx.font = '700 22px Outfit, sans-serif';
  ctx.fillText('Tatu Exposure Lab by Storitellah', 740, 590);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), 'image/jpeg', 0.9);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
