/**
 * Local persistence.
 * - IndexedDB stores captured photographs (blobs + settings metadata).
 * - localStorage stores small preferences and learning progress.
 * Nothing ever leaves the device.
 */
import type { ExposureSettings } from '../engine/settings';
import type { ScoreBreakdown } from '../engine/scoring';

export interface StoredShot {
  id: string;
  createdAt: number;
  sceneId: string;
  cameraId: string;
  lensId: string;
  settings: ExposureSettings;
  meter: number;
  challengeId?: string;
  score?: ScoreBreakdown;
  favourite: boolean;
  reflection: string;
  /** JPEG blob of the rendered photograph. */
  blob: Blob;
  thumb: Blob;
}

const DB_NAME = 'tatu-exposure-lab';
const DB_VERSION = 1;
const STORE = 'shots';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('indexeddb-unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('db-open-failed'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('db-request-failed'));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveShot(shot: StoredShot): Promise<void> {
  await tx('readwrite', (s) => s.put(shot));
}

export async function deleteShot(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function updateShot(shot: StoredShot): Promise<void> {
  await tx('readwrite', (s) => s.put(shot));
}

export async function listShots(): Promise<StoredShot[]> {
  try {
    const all = await tx<StoredShot[]>('readonly', (s) => s.getAll() as IDBRequest<StoredShot[]>);
    return all
      .filter((shot) => shot && typeof shot.id === 'string' && shot.blob instanceof Blob)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getShot(id: string): Promise<StoredShot | undefined> {
  try {
    return await tx<StoredShot | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredShot | undefined>);
  } catch {
    return undefined;
  }
}

export async function clearAllShots(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}

/* ------------------------- preferences ------------------------- */

export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  sound: boolean;
  animations: boolean;
  gamification: boolean;
  highContrast: boolean;
  largeControls: boolean;
  quality: 'auto' | 'low' | 'medium' | 'high';
  onboardingDone: boolean;
  realisticControls: boolean;
  photographerName: string;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system', sound: true, animations: true, gamification: true,
  highContrast: false, largeControls: false, quality: 'auto',
  onboardingDone: false, realisticControls: false, photographerName: '',
};

const PREFS_KEY = 'tatu-prefs';

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* full or blocked */ }
}

/* ------------------------- progress ------------------------- */

export interface Progress {
  completedLessons: string[];
  badges: string[];
  bestScores: Record<string, number>;
  streakDays: number;
  lastPracticeDay: string; // YYYY-MM-DD
}

export const DEFAULT_PROGRESS: Progress = {
  completedLessons: [], badges: [], bestScores: {}, streakDays: 0, lastPracticeDay: '',
};

const PROGRESS_KEY = 'tatu-progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(p: Progress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* non-fatal */ }
}

/** Update the on-device practice streak. Called after each kept shot or lesson. */
export function recordPractice(p: Progress): Progress {
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastPracticeDay === today) return p;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakDays = p.lastPracticeDay === yesterday ? p.streakDays + 1 : 1;
  return { ...p, streakDays, lastPracticeDay: today };
}

export function clearAllLocalData(): Promise<void> {
  try {
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem('tatu-lang');
  } catch { /* non-fatal */ }
  return clearAllShots();
}
