/**
 * Original illustrated drawing primitives used to compose every scene.
 * All artwork is generated procedurally at runtime — nothing is copied
 * from photographs or third-party illustrations.
 *
 * Coordinates use a 800 × 500 reference frame; the renderer scales.
 */
export type Ctx = CanvasRenderingContext2D;
export const REF_W = 800;
export const REF_H = 500;

/** Deterministic pseudo-random generator so scenes look identical everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function skyGradient(ctx: Ctx, top: string, bottom: string, horizon = 0.62): void {
  const g = ctx.createLinearGradient(0, 0, 0, REF_H * horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, REF_W, REF_H * horizon + 2);
}

export function ground(ctx: Ctx, colour: string, horizon = 0.62): void {
  ctx.fillStyle = colour;
  ctx.fillRect(0, REF_H * horizon, REF_W, REF_H * (1 - horizon));
}

export function sun(ctx: Ctx, x: number, y: number, r: number, colour = '#FFE9A8'): void {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function mountains(ctx: Ctx, colour: string, baseY: number, seed = 7): void {
  const rnd = mulberry32(seed);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  let x = 0;
  while (x < REF_W) {
    const peakW = 90 + rnd() * 140;
    const peakH = 40 + rnd() * 90;
    ctx.lineTo(x + peakW / 2, baseY - peakH);
    ctx.lineTo(x + peakW, baseY);
    x += peakW;
  }
  ctx.lineTo(REF_W, baseY);
  ctx.closePath();
  ctx.fill();
}

export function building(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  colour: string, windowColour = 'rgba(255,236,170,0.85)', litRatio = 0.5, seed = 3,
): void {
  const rnd = mulberry32(seed);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y - h, w, h);
  const cols = Math.max(2, Math.floor(w / 18));
  const rows = Math.max(3, Math.floor(h / 22));
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rnd() < litRatio) {
        ctx.fillStyle = windowColour;
        ctx.fillRect(x + 4 + c * (w - 8) / cols, y - h + 6 + r * (h - 12) / rows, (w - 8) / cols - 5, (h - 12) / rows - 7);
      }
    }
  }
}

export function tree(ctx: Ctx, x: number, y: number, size: number, leaf = '#3E7C4F', trunk = '#6B4A2F'): void {
  ctx.fillStyle = trunk;
  ctx.fillRect(x - size * 0.06, y - size * 0.55, size * 0.12, size * 0.55);
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.75, size * 0.42, 0, Math.PI * 2);
  ctx.arc(x - size * 0.28, y - size * 0.55, size * 0.3, 0, Math.PI * 2);
  ctx.arc(x + size * 0.28, y - size * 0.55, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export interface PersonOpts {
  skin: string;
  top: string;
  bottom: string;
  pose?: 'stand' | 'run' | 'sit' | 'ride';
  facing?: 1 | -1;
  hair?: string;
}

/** Stylised figure roughly `size` px tall with feet at (x, y). */
export function person(ctx: Ctx, x: number, y: number, size: number, o: PersonOpts): void {
  const f = o.facing ?? 1;
  const headR = size * 0.11;
  const pose = o.pose ?? 'stand';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f, 1);
  // legs
  ctx.strokeStyle = o.bottom;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose === 'run') {
    ctx.moveTo(0, -size * 0.45); ctx.lineTo(size * 0.18, -size * 0.2); ctx.lineTo(size * 0.28, 0);
    ctx.moveTo(0, -size * 0.45); ctx.lineTo(-size * 0.16, -size * 0.22); ctx.lineTo(-size * 0.3, -size * 0.12);
  } else if (pose === 'sit' || pose === 'ride') {
    ctx.moveTo(0, -size * 0.45); ctx.lineTo(size * 0.2, -size * 0.42); ctx.lineTo(size * 0.2, -size * 0.1);
    ctx.moveTo(0, -size * 0.45); ctx.lineTo(size * 0.14, -size * 0.4); ctx.lineTo(size * 0.14, -size * 0.08);
  } else {
    ctx.moveTo(-size * 0.06, -size * 0.45); ctx.lineTo(-size * 0.07, 0);
    ctx.moveTo(size * 0.06, -size * 0.45); ctx.lineTo(size * 0.08, 0);
  }
  ctx.stroke();
  // torso
  ctx.strokeStyle = o.top;
  ctx.lineWidth = size * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.44);
  ctx.lineTo(pose === 'run' ? size * 0.06 : 0, -size * 0.74);
  ctx.stroke();
  // arms
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  if (pose === 'run') {
    ctx.moveTo(0, -size * 0.68); ctx.lineTo(size * 0.2, -size * 0.6);
    ctx.moveTo(0, -size * 0.68); ctx.lineTo(-size * 0.18, -size * 0.52);
  } else if (pose === 'ride') {
    ctx.moveTo(0, -size * 0.68); ctx.lineTo(size * 0.24, -size * 0.58);
  } else {
    ctx.moveTo(0, -size * 0.7); ctx.lineTo(size * 0.13, -size * 0.48);
    ctx.moveTo(0, -size * 0.7); ctx.lineTo(-size * 0.13, -size * 0.48);
  }
  ctx.stroke();
  // head + hair
  ctx.fillStyle = o.skin;
  ctx.beginPath();
  ctx.arc(pose === 'run' ? size * 0.08 : 0, -size * 0.85, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = o.hair ?? '#1d1d1d';
  ctx.beginPath();
  ctx.arc(pose === 'run' ? size * 0.08 : 0, -size * 0.88, headR * 0.95, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.restore();
}

export function ball(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#F6F3EA';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#26262b';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.stroke();
}

export function bicycle(ctx: Ctx, x: number, y: number, size: number, frame = '#C63C3C'): void {
  const r = size * 0.3;
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = size * 0.05;
  ctx.beginPath(); ctx.arc(x - size * 0.42, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + size * 0.42, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = frame;
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.42, y); ctx.lineTo(x - size * 0.05, y - size * 0.45);
  ctx.lineTo(x + size * 0.3, y - size * 0.45); ctx.lineTo(x + size * 0.42, y);
  ctx.moveTo(x - size * 0.05, y - size * 0.45); ctx.lineTo(x + size * 0.05, y);
  ctx.lineTo(x - size * 0.42, y);
  ctx.stroke();
}

export function car(ctx: Ctx, x: number, y: number, size: number, colour: string): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - size * 0.5, y - size * 0.3, size, size * 0.22, size * 0.05);
  ctx.roundRect(x - size * 0.28, y - size * 0.46, size * 0.5, size * 0.2, size * 0.06);
  ctx.fill();
  ctx.fillStyle = '#22232a';
  ctx.beginPath();
  ctx.arc(x - size * 0.28, y - size * 0.06, size * 0.09, 0, Math.PI * 2);
  ctx.arc(x + size * 0.28, y - size * 0.06, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.95)';
  ctx.fillRect(x + size * 0.42, y - size * 0.28, size * 0.08, size * 0.06);
}

export function bird(ctx: Ctx, x: number, y: number, size: number, colour = '#3a3f4a'): void {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.quadraticCurveTo(x - size * 0.4, y - size * 0.7, x - size * 0.9, y - size * 0.5);
  ctx.moveTo(x, y); ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.7, x + size * 0.9, y - size * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y); ctx.lineTo(x + size * 0.72, y - size * 0.06);
  ctx.stroke();
}

export function waterfall(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(220,238,248,0.95)');
  g.addColorStop(1, 'rgba(180,214,236,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 6; i++) ctx.fillRect(x + (i * w) / 6 + 2, y, 2, h);
}

export function streetlamp(ctx: Ctx, x: number, y: number, h: number): void {
  ctx.strokeStyle = '#3b3b40';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + 18, y - h); ctx.stroke();
  const g = ctx.createRadialGradient(x + 18, y - h + 4, 2, x + 18, y - h + 4, 26);
  g.addColorStop(0, 'rgba(255,225,150,0.95)');
  g.addColorStop(1, 'rgba(255,225,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x + 18, y - h + 4, 26, 0, Math.PI * 2); ctx.fill();
}

export function window_(ctx: Ctx, x: number, y: number, w: number, h: number, light = '#FFF4D6'): void {
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

export function marketStall(ctx: Ctx, x: number, y: number, size: number, canopy: string, seed = 5): void {
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - size * 0.5, y - size * 0.35, size, size * 0.35);
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.6, y - size * 0.35);
  ctx.lineTo(x - size * 0.45, y - size * 0.7);
  ctx.lineTo(x + size * 0.45, y - size * 0.7);
  ctx.lineTo(x + size * 0.6, y - size * 0.35);
  ctx.closePath();
  ctx.fill();
  const fruits = ['#E9A13B', '#C63C3C', '#2E9B62', '#F2D24B'];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = fruits[Math.floor(rnd() * fruits.length)] as string;
    ctx.beginPath();
    ctx.arc(x - size * 0.42 + rnd() * size * 0.84, y - size * 0.3 + rnd() * size * 0.2, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function stageLight(ctx: Ctx, x: number, y: number, angle: number, colour: string, length = 320): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, 0, length);
  g.addColorStop(0, colour);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(70, length); ctx.lineTo(-70, length);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function plate(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#FBFAF6';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E9A13B';
  ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.05, r * 0.35, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2E9B62';
  ctx.beginPath(); ctx.ellipse(x + r * 0.25, y, r * 0.25, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#C63C3C';
  ctx.beginPath(); ctx.arc(x + r * 0.05, y + r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill();
}
