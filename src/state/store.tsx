/**
 * Application state: camera settings (with undo/redo), selected gear,
 * scene, preferences and learning progress. Simulation physics stays in
 * src/engine — this store only coordinates state.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode,
} from 'react';
import { defaultSettings, type ExposureSettings } from '../engine/settings';
import {
  cameraById, lensById, type CameraProfile, type LensProfile, checkCompatibility,
} from '../data/catalogue';
import {
  DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs,
  DEFAULT_PROGRESS, loadProgress, saveProgress, recordPractice, type Progress,
} from './db';
import { sceneById, startSettingsFor } from '../scenes/scenes';

export interface AppState {
  settings: ExposureSettings;
  past: ExposureSettings[];
  future: ExposureSettings[];
  cameraId: string;
  lensId: string;
  sceneId: string;
  prefs: Prefs;
  progress: Progress;
  lockedControls: string[];
}

type Action =
  | { type: 'set-settings'; patch: Partial<ExposureSettings>; recordHistory?: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset-exposure' }
  | { type: 'set-camera'; id: string }
  | { type: 'set-lens'; id: string }
  | { type: 'set-scene'; id: string; applyStart?: boolean; patch?: Partial<ExposureSettings> }
  | { type: 'set-prefs'; patch: Partial<Prefs> }
  | { type: 'set-locks'; locks: string[] }
  | { type: 'complete-lesson'; id: string }
  | { type: 'award-badge'; id: string }
  | { type: 'record-score'; challengeId: string; score: number }
  | { type: 'record-practice' }
  | { type: 'reset-progress' };

const HISTORY_LIMIT = 50;

function clampToGear(s: ExposureSettings, cam: CameraProfile, lens: LensProfile): ExposureSettings {
  const out = { ...s };
  out.aperture = Math.min(lens.minAperture, Math.max(lens.maxAperture, out.aperture));
  out.focalMm = Math.min(lens.maxFocal, Math.max(lens.minFocal, out.focalMm));
  out.focusDistM = Math.max(lens.minFocusM, out.focusDistM);
  out.iso = Math.min(cam.isoExtMax, Math.max(cam.isoExtMin, out.iso));
  const shortest = 1 / Math.max(cam.mechShutterMax, cam.eShutterMax);
  out.shutter = Math.min(cam.mechShutterMin, Math.max(shortest, out.shutter));
  return out;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-settings': {
      const cam = cameraById(state.cameraId);
      const lens = lensById(state.lensId);
      const filtered: Partial<ExposureSettings> = { ...action.patch };
      for (const lock of state.lockedControls) {
        delete (filtered as Record<string, unknown>)[lock];
      }
      const next = clampToGear({ ...state.settings, ...filtered }, cam, lens);
      const record = action.recordHistory !== false;
      return {
        ...state,
        settings: next,
        past: record ? [...state.past.slice(-HISTORY_LIMIT), state.settings] : state.past,
        future: record ? [] : state.future,
      };
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        settings: prev,
        past: state.past.slice(0, -1),
        future: [state.settings, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        settings: next,
        past: [...state.past, state.settings].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
    case 'reset-exposure':
      return { ...state, settings: defaultSettings(), past: [...state.past, state.settings], future: [] };
    case 'set-camera': {
      const cam = cameraById(action.id);
      let lensId = state.lensId;
      const compat = checkCompatibility(lensById(lensId), cam);
      if (compat.status === 'incompatible') lensId = 'generic-50';
      const lens = lensById(lensId);
      return { ...state, cameraId: cam.id, lensId, settings: clampToGear(state.settings, cam, lens) };
    }
    case 'set-lens': {
      const lens = lensById(action.id);
      const cam = cameraById(state.cameraId);
      if (checkCompatibility(lens, cam).status === 'incompatible') return state;
      const focal = Math.min(lens.maxFocal, Math.max(lens.minFocal, state.settings.focalMm));
      return {
        ...state, lensId: lens.id,
        settings: clampToGear({ ...state.settings, focalMm: focal }, cam, lens),
      };
    }
    case 'set-scene': {
      const scene = sceneById(action.id);
      if (!action.applyStart) return { ...state, sceneId: scene.id };
      // Arrive at the scene with a workable exposure, as if the camera had
      // just been used in this light. Lessons and challenges may override.
      const cam = cameraById(state.cameraId);
      const lens = lensById(state.lensId);
      // Scene start and any caller patch (a lesson's deliberate starting
      // point) are applied in one update, so the viewfinder never flashes
      // an intermediate exposure.
      const next = { ...state.settings, ...startSettingsFor(scene), ...(action.patch ?? {}) };
      return {
        ...state,
        sceneId: scene.id,
        settings: clampToGear(next, cam, lens),
        past: [...state.past.slice(-HISTORY_LIMIT), state.settings],
        future: [],
      };
    }
    case 'set-prefs': {
      const prefs = { ...state.prefs, ...action.patch };
      savePrefs(prefs);
      return { ...state, prefs };
    }
    case 'set-locks':
      return { ...state, lockedControls: action.locks };
    case 'complete-lesson': {
      if (state.progress.completedLessons.includes(action.id)) return state;
      const progress = recordPractice({
        ...state.progress,
        completedLessons: [...state.progress.completedLessons, action.id],
      });
      saveProgress(progress);
      return { ...state, progress };
    }
    case 'award-badge': {
      if (state.progress.badges.includes(action.id)) return state;
      const progress = { ...state.progress, badges: [...state.progress.badges, action.id] };
      saveProgress(progress);
      return { ...state, progress };
    }
    case 'record-score': {
      const best = state.progress.bestScores[action.challengeId] ?? 0;
      const progress = recordPractice({
        ...state.progress,
        bestScores: { ...state.progress.bestScores, [action.challengeId]: Math.max(best, action.score) },
      });
      saveProgress(progress);
      return { ...state, progress };
    }
    case 'record-practice': {
      const progress = recordPractice(state.progress);
      saveProgress(progress);
      return { ...state, progress };
    }
    case 'reset-progress': {
      saveProgress({ ...DEFAULT_PROGRESS });
      savePrefs({ ...DEFAULT_PREFS });
      return { ...state, progress: { ...DEFAULT_PROGRESS }, prefs: { ...DEFAULT_PREFS } };
    }
    default:
      return state;
  }
}

function initialState(): AppState {
  const firstScene = sceneById('outdoor-portrait');
  return {
    // Open on a correctly-exposed frame so the first thing a learner sees
    // is a good photograph, not a blown-out one.
    settings: { ...defaultSettings(), ...startSettingsFor(firstScene) },
    past: [],
    future: [],
    cameraId: 'generic',
    lensId: 'generic-50',
    sceneId: firstScene.id,
    prefs: loadPrefs(),
    progress: loadProgress(),
    lockedControls: [],
  };
}

interface StoreValue {
  state: AppState;
  dispatch: (a: Action) => void;
  camera: CameraProfile;
  lens: LensProfile;
  update: (patch: Partial<ExposureSettings>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const update = useCallback(
    (patch: Partial<ExposureSettings>) => dispatch({ type: 'set-settings', patch }),
    [],
  );

  // Reflect accessibility/theme preferences onto the document element.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.prefs.theme;
    root.classList.toggle('high-contrast', state.prefs.highContrast);
    root.classList.toggle('large-controls', state.prefs.largeControls);
    root.classList.toggle('no-animations', !state.prefs.animations);
  }, [state.prefs]);

  const value = useMemo<StoreValue>(() => ({
    state,
    dispatch,
    camera: cameraById(state.cameraId),
    lens: lensById(state.lensId),
    update,
  }), [state, update]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
