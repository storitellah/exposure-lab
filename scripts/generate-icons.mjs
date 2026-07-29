/**
 * Generates the PWA PNG icons (192, 512, maskable 512) without any image
 * dependency: pixels are drawn in a buffer and encoded as PNG using zlib.
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const DARK = hex('#171717');
const YELLOW = hex('#FBB03B');
const CREAM = hex('#F3F1EC');
const BLUE = hex('#3C82F6');
const GREEN = hex('#2E9B62');

function drawIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const cx = size / 2;
  const cy = size / 2;
  const corner = maskable ? 0 : size * 0.2;

  // Background rounded square (full bleed when maskable).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(corner - x, x - (size - corner), 0);
      const dy = Math.max(corner - y, y - (size - corner), 0);
      if (Math.hypot(dx, dy) <= corner || corner === 0) set(x, y, DARK);
    }
  }

  const scale = maskable ? 0.62 : 0.78; // keep artwork in the safe zone
  const ringR = (size / 2) * scale * 0.92;
  const ringW = size * 0.045;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - ringR) < ringW) set(x, y, YELLOW);
    }
  }

  // Triangle outline connecting the three control dots.
  const pts = [
    [cx, cy - ringR * 0.62],
    [cx + ringR * 0.56, cy + ringR * 0.44],
    [cx - ringR * 0.56, cy + ringR * 0.44],
  ];
  const lineW = size * 0.02;
  const drawLine = ([x1, y1], [x2, y2]) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const y = y1 + ((y2 - y1) * i) / steps;
      for (let oy = -lineW; oy <= lineW; oy++) {
        for (let ox = -lineW; ox <= lineW; ox++) {
          if (Math.hypot(ox, oy) <= lineW) set(Math.round(x + ox), Math.round(y + oy), CREAM);
        }
      }
    }
  };
  drawLine(pts[0], pts[1]);
  drawLine(pts[1], pts[2]);
  drawLine(pts[2], pts[0]);

  // Control dots.
  const dotR = size * 0.055;
  const colors = [YELLOW, BLUE, GREEN];
  pts.forEach(([x, y], i) => {
    for (let oy = -dotR; oy <= dotR; oy++) {
      for (let ox = -dotR; ox <= dotR; ox++) {
        if (Math.hypot(ox, oy) <= dotR) set(Math.round(x + ox), Math.round(y + oy), colors[i]);
      }
    }
  });

  return encodePng(size, size, px);
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192, false));
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512, false));
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, true));
console.log('Icons written to public/icons/');
