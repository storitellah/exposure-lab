/**
 * Typed access to the camera and lens catalogues, plus the mount
 * compatibility engine. Catalogue data lives in versioned JSON files so it
 * can be updated (or replaced via JSON/CSV import) without touching the UI.
 */
import camerasJson from './cameras.json';
import lensesJson from './lenses.json';
import type { SensorFormat } from '../engine/optics';
import type { CameraLimits } from '../engine/autoexposure';

export interface CameraProfile {
  id: string;
  manufacturer: string;
  model: string;
  system: string;
  mount: string;
  sensorFormat: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  cropFactor: number;
  resolutionMp: number;
  isoMin: number;
  isoMax: number;
  isoExtMin: number;
  isoExtMax: number;
  baseIso: number;
  dualNativeIso: number | null;
  mechShutterMin: number; // longest mechanical time in seconds
  mechShutterMax: number; // shortest, expressed as denominator (e.g. 8000 = 1/8000)
  eShutterMax: number;
  flashSync: number;      // denominator; 0 = no flash sync (cinema bodies)
  ibis: boolean;
  photoModes: string[];
  videoFps: number[];
  videoRes: string[];
  logProfiles: string[];
  drBaseStops: number;
  noise: { cleanIso: number; strength: number };
  bodyStyle: string;
  releaseStatus: string;
  dataSource: string;
  /** The lens this body is normally sold with (or its built-in lens). */
  kitLensId?: string;
  /** Lenses worth trying first on this body; listed at the top of the picker. */
  suggestedLensIds?: string[];
}

export interface LensProfile {
  id: string;
  manufacturer: string;
  model: string;
  mount: string;
  coverage: 'full-frame' | 'aps-c' | 'mft' | 's35' | 'medium-format';
  minFocal: number;
  maxFocal: number;
  /** Widest aperture at the short end of the zoom (or the only one on a prime). */
  maxAperture: number;
  /**
   * Widest aperture at the long end, for zooms whose maximum aperture
   * narrows as you zoom in — most kit lenses. Omitted on constant-aperture
   * zooms and primes.
   */
  maxApertureTele?: number;
  minAperture: number;
  tStop: number | null;
  type: 'prime' | 'zoom';
  class: 'photo' | 'video' | 'cinema' | 'hybrid';
  category: string;
  minFocusM: number;
  stabilised: boolean;
  af: boolean;
  mf: boolean;
  focusBreathing: string;
  distortion: string;
  vignetting: string;
  anamorphicSqueeze: number;
  weight: string;
  source: string;
}

export const CAMERAS: CameraProfile[] = camerasJson.cameras as CameraProfile[];
export const LENSES: LensProfile[] = lensesJson.lenses as LensProfile[];
export const CATALOGUE_VERSION = camerasJson.catalogueVersion;
export const CATALOGUE_DISCLAIMER = camerasJson.disclaimer;

export function cameraById(id: string): CameraProfile {
  return CAMERAS.find((c) => c.id === id) ?? (CAMERAS[0] as CameraProfile);
}
export function lensById(id: string): LensProfile {
  return LENSES.find((l) => l.id === id) ?? (LENSES[0] as LensProfile);
}

/**
 * Display name for a body or lens: "Canon EOS R6 Mark II", but plain
 * "Generic Camera" where the model already carries the maker's name.
 */
export function gearLabel(item: { manufacturer: string; model: string }): string {
  return item.model.toLowerCase().startsWith(item.manufacturer.toLowerCase())
    ? item.model
    : `${item.manufacturer} ${item.model}`;
}

export function sensorOf(cam: CameraProfile): SensorFormat {
  return { name: cam.sensorFormat, widthMm: cam.sensorWidthMm, heightMm: cam.sensorHeightMm };
}

/**
 * Widest aperture actually available at a given focal length.
 *
 * On a kit zoom the maximum aperture narrows as you zoom in — an 18-45mm
 * f/4.5-6.3 can only open to f/6.3 once it is racked out to 45mm. The
 * f-number is proportional to focal length over entrance-pupil diameter, so
 * interpolating logarithmically between the two published ends tracks the
 * real behaviour closely and lands on sensible values in between.
 */
export function maxApertureAt(lens: LensProfile, focalMm: number): number {
  const tele = lens.maxApertureTele;
  if (!tele || lens.maxFocal <= lens.minFocal) return lens.maxAperture;
  const focal = Math.min(lens.maxFocal, Math.max(lens.minFocal, focalMm));
  const t = Math.log(focal / lens.minFocal) / Math.log(lens.maxFocal / lens.minFocal);
  return lens.maxAperture * Math.pow(tele / lens.maxAperture, t);
}

/** True when the lens's widest aperture changes across its zoom range. */
export function isVariableAperture(lens: LensProfile): boolean {
  return Boolean(lens.maxApertureTele && lens.maxApertureTele > lens.maxAperture);
}

export function limitsOf(cam: CameraProfile, lens: LensProfile, focalMm?: number): CameraLimits {
  return {
    minIso: cam.isoExtMin,
    maxIso: cam.isoExtMax,
    minShutter: cam.mechShutterMin,
    maxShutter: 1 / Math.max(cam.mechShutterMax, cam.eShutterMax),
    minAperture: focalMm === undefined ? lens.maxAperture : maxApertureAt(lens, focalMm),
    maxAperture: lens.minAperture,
  };
}

/* ------------------------------------------------------------------ */
/* Mount compatibility engine                                          */
/* ------------------------------------------------------------------ */

export interface Adapter {
  lensMount: string;
  bodyMount: string;
  name: string;
  /** Limitation keys shown to the user (translated in the UI). */
  limitations: ('manual-focus-only' | 'slower-af' | 'no-electronic-control' | 'crop-mode' | 'no-stabilisation-link')[];
}

export const ADAPTERS: Adapter[] = [
  { lensMount: 'ef', bodyMount: 'rf', name: 'EF–RF mount adapter', limitations: [] },
  { lensMount: 'ef', bodyMount: 'e', name: 'EF–E smart adapter', limitations: ['slower-af'] },
  { lensMount: 'ef', bodyMount: 'z', name: 'EF–Z smart adapter', limitations: ['slower-af'] },
  { lensMount: 'ef', bodyMount: 'l', name: 'EF–L smart adapter', limitations: ['slower-af'] },
  { lensMount: 'ef', bodyMount: 'mft', name: 'EF–MFT adapter', limitations: ['slower-af', 'crop-mode'] },
  { lensMount: 'ef', bodyMount: 'kinemount', name: 'KineMOUNT EF adapter', limitations: ['no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'kinemount', name: 'KineMOUNT PL adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'rf', name: 'PL–RF adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'e', name: 'PL–E adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'l', name: 'PL–L adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'z', name: 'PL–Z adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'pl', bodyMount: 'mft', name: 'PL–MFT adapter', limitations: ['manual-focus-only', 'no-electronic-control', 'crop-mode'] },
  { lensMount: 'lpl', bodyMount: 'rf', name: 'RF–LPL adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'lpl', bodyMount: 'kinemount', name: 'KineMOUNT LPL adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'm', bodyMount: 'e', name: 'M–E adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'm', bodyMount: 'z', name: 'M–Z adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'm', bodyMount: 'l', name: 'M–L adapter', limitations: ['manual-focus-only', 'no-electronic-control'] },
  { lensMount: 'm', bodyMount: 'mft', name: 'M–MFT adapter', limitations: ['manual-focus-only', 'no-electronic-control', 'crop-mode'] },
];

export type Compatibility =
  | { status: 'native' }
  | { status: 'adapter'; adapter: Adapter }
  | { status: 'incompatible'; reason: 'mount' | 'coverage' };

const COVERAGE_DIAG: Record<LensProfile['coverage'], number> = {
  'full-frame': 43.3,
  'aps-c': 28.3,
  s35: 27.4,
  mft: 21.6,
  'medium-format': 55,
};

/**
 * Decide whether a lens fits a body. "generic" mounts fit everything so the
 * Generic Camera and Custom Lens always work.
 */
/** Built-in lenses use a `fixed-` mount that only ever matches its own body. */
export function isFixedMount(mount: string): boolean {
  return mount.startsWith('fixed-');
}

export function checkCompatibility(lens: LensProfile, cam: CameraProfile): Compatibility {
  // A fixed-lens camera (X100VI, ZX1) takes nothing but its own lens, and a
  // built-in lens cannot be removed and put on anything else.
  if (isFixedMount(cam.mount) || isFixedMount(lens.mount)) {
    return lens.mount === cam.mount ? { status: 'native' } : { status: 'incompatible', reason: 'mount' };
  }
  if (lens.mount === 'generic' || cam.mount === 'generic') return { status: 'native' };

  // A lens whose image circle is far smaller than the sensor cannot cover it.
  const camDiag = Math.hypot(cam.sensorWidthMm, cam.sensorHeightMm);
  const lensDiag = COVERAGE_DIAG[lens.coverage];
  const coverageOk = lensDiag >= camDiag * 0.82; // crop-mode tolerance

  if (lens.mount === cam.mount) {
    if (!coverageOk) {
      // Same mount, smaller image circle (e.g. APS-C lens on full frame):
      // most systems switch to crop mode rather than refuse the lens.
      const cropAdapter: Adapter = {
        lensMount: lens.mount, bodyMount: cam.mount,
        name: 'Automatic crop mode', limitations: ['crop-mode'],
      };
      return { status: 'adapter', adapter: cropAdapter };
    }
    return { status: 'native' };
  }

  const adapter = ADAPTERS.find((a) => a.lensMount === lens.mount && a.bodyMount === cam.mount);
  if (!adapter) return { status: 'incompatible', reason: 'mount' };
  if (!coverageOk && !adapter.limitations.includes('crop-mode')) {
    return { status: 'adapter', adapter: { ...adapter, limitations: [...adapter.limitations, 'crop-mode'] } };
  }
  return { status: 'adapter', adapter };
}

/** The lens to fit when switching to a body whose current lens will not mount. */
export function preferredLensFor(cam: CameraProfile): string {
  return cam.kitLensId ?? cam.suggestedLensIds?.[0] ?? 'generic-50';
}

export function compatibleLenses(cam: CameraProfile): { lens: LensProfile; compat: Compatibility }[] {
  return LENSES.map((lens) => ({ lens, compat: checkCompatibility(lens, cam) }));
}
