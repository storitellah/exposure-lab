/**
 * Input sanitisation for user-editable text (names, reflections, filenames)
 * and validation of challenge-link URL parameters.
 * User text is always rendered with textContent, never as HTML; these
 * helpers add defence in depth and enforce sensible limits.
 */

export const MAX_TEXT = 280;
export const MAX_NAME = 60;
export const MAX_URL_STATE = 512;

/** Strip control characters and angle brackets, collapse whitespace, cap length. */
export function sanitizeText(input: unknown, maxLen = MAX_TEXT): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Safe filename: ASCII letters, digits, dash, underscore only. */
export function sanitizeFilename(input: unknown, fallback = 'photo'): string {
  const base = sanitizeText(input, 64).replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/ +/g, '-');
  return (base || fallback).slice(0, 64);
}

export interface ChallengeUrlState {
  challengeId: string;
  sceneId: string;
  aperture?: number;
  shutter?: number;
  iso?: number;
  locked?: ('aperture' | 'shutter' | 'iso')[];
}

const ID_RE = /^[a-z0-9-]{1,40}$/;
const LOCKABLE = new Set(['aperture', 'shutter', 'iso']);

function finiteInRange(raw: string | null, min: number, max: number): number | undefined {
  if (raw === null || raw === '' || raw.length > 12) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

/**
 * Parse a challenge link's query string. Rejects oversized input, unknown
 * ids, out-of-range numbers and anything that is not on the allowlist.
 * Returns null when the state cannot be trusted.
 */
export function parseChallengeUrl(
  search: string,
  knownChallenges: ReadonlySet<string>,
  knownScenes: ReadonlySet<string>,
): ChallengeUrlState | null {
  if (typeof search !== 'string' || search.length > MAX_URL_STATE) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const challengeId = params.get('c') ?? '';
  const sceneId = params.get('sc') ?? '';
  if (!ID_RE.test(challengeId) || !knownChallenges.has(challengeId)) return null;
  if (!ID_RE.test(sceneId) || !knownScenes.has(sceneId)) return null;

  const state: ChallengeUrlState = { challengeId, sceneId };
  const a = finiteInRange(params.get('a'), 0.7, 64);
  const sh = finiteInRange(params.get('s'), 1 / 32000, 60);
  const iso = finiteInRange(params.get('i'), 25, 819200);
  if (a !== undefined) state.aperture = a;
  if (sh !== undefined) state.shutter = sh;
  if (iso !== undefined) state.iso = iso;

  const lockRaw = params.get('lock');
  if (lockRaw !== null) {
    if (lockRaw.length > 30) return null;
    const locks = lockRaw.split(',').filter((l) => LOCKABLE.has(l));
    if (locks.length) state.locked = locks as ChallengeUrlState['locked'];
  }
  return state;
}

/** Build a deterministic, personal-data-free challenge link query string. */
export function buildChallengeUrl(state: ChallengeUrlState): string {
  const p = new URLSearchParams();
  p.set('c', state.challengeId);
  p.set('sc', state.sceneId);
  if (state.aperture !== undefined) p.set('a', String(state.aperture));
  if (state.shutter !== undefined) p.set('s', String(state.shutter));
  if (state.iso !== undefined) p.set('i', String(state.iso));
  if (state.locked?.length) p.set('lock', state.locked.join(','));
  const qs = p.toString();
  return qs.length <= MAX_URL_STATE ? qs : '';
}

/** Verify an uploaded file really is a supported image by its signature. */
export async function verifyImageFile(file: Blob): Promise<'jpeg' | 'png' | 'webp' | null> {
  if (file.size > 25 * 1024 * 1024) return null; // 25 MB cap
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) return 'webp';
  return null;
}
