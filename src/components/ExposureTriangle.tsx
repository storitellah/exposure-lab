/**
 * The exposure triangle, live.
 *
 * Each corner shows a setting's current value, how much light it is letting
 * through, and what it does to the picture besides brightness. The centre
 * shows the combined result. Below, "same brightness, different picture"
 * lists trades that keep the exposure identical — moving a stop from one
 * corner to another — which is the whole idea of the triangle.
 */
import { useMemo } from 'react';
import {
  APERTURES, SHUTTERS, ISOS, nearest, formatAperture, formatShutter,
  type ExposureSettings,
} from '../engine/settings';
import { settingsEV100 } from '../engine/exposure';
import { depthOfField, shakeAmount, type SensorFormat } from '../engine/optics';
import { noiseAmount, type NoiseProfile } from '../engine/noise';
import { subjectBlurPx } from '../engine/scoring';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';

export interface GearLimits {
  widestAperture: number;
  narrowestAperture: number;
  longestShutter: number;
  shortestShutter: number;
  minIso: number;
  maxIso: number;
}

interface Props {
  settings: ExposureSettings;
  meter: number;
  sensor: SensorFormat;
  noiseProfile: NoiseProfile;
  subjectSpeedPxPerS: number;
  limits: GearLimits;
  /** When given, each alternative gets a "Try this" button. */
  onApply?: (patch: Partial<ExposureSettings>) => void;
}

const COLOURS = { aperture: '#FBB03B', shutter: '#3C82F6', iso: '#2E9B62' } as const;
/** Aperture at the top, shutter bottom-left, ISO bottom-right — as in the logo. */
const VERTICES: [number, number][] = [[150, 34], [38, 214], [262, 214]];

/** 0..1: where a value sits in its full range, by light let through. */
const lightShare = {
  aperture: (n: number) => 1 - Math.log(n / 1) / Math.log(22 / 1),
  shutter: (t: number) => Math.log(t / (1 / 8000)) / Math.log(30 / (1 / 8000)),
  iso: (i: number) => Math.log(i / 50) / Math.log(204800 / 50),
};

function dofEffect(totalM: number): TranslationKey {
  if (totalM < 0.5) return 'effectDofVeryShallow';
  if (totalM < 2) return 'effectDofShallow';
  if (totalM < 15) return 'effectDofModerate';
  return 'effectDofDeep';
}

function motionEffect(blurPx: number, shake: number, moving: boolean): TranslationKey {
  if (!moving) return shake > 0.5 ? 'effectShakeRisk' : 'effectSharpHandheld';
  if (blurPx + shake * 4 < 2) return 'effectMotionFrozen';
  if (blurPx + shake * 4 < 8) return 'effectMotionSlight';
  return 'effectMotionBlur';
}

function noiseEffect(n: number): TranslationKey {
  if (n < 0.08) return 'effectNoiseClean';
  if (n < 0.25) return 'effectNoiseSlight';
  if (n < 0.5) return 'effectNoiseVisible';
  return 'effectNoiseHeavy';
}

/** Move a value along its third-stop table; undefined if it runs off the end. */
function shift(table: number[], value: number, thirds: number): number | undefined {
  const idx = table.indexOf(nearest(table, value));
  return table[idx + thirds];
}

interface Alternative {
  patch: Pick<ExposureSettings, 'aperture' | 'shutter' | 'iso'>;
  effect: TranslationKey;
}

/**
 * Trades that keep brightness the same. Index directions: APERTURES rises in
 * f-number (less light), SHUTTERS runs long → short (less light), ISOS rises
 * (more light). Two stops is six third-stop steps; fall back to one stop.
 */
function alternatives(s: ExposureSettings, lim: GearLimits): Alternative[] {
  const inRange = (p: Alternative['patch']) =>
    p.aperture >= lim.widestAperture - 1e-9 && p.aperture <= lim.narrowestAperture + 1e-9 &&
    p.shutter <= lim.longestShutter + 1e-9 && p.shutter >= lim.shortestShutter - 1e-12 &&
    p.iso >= lim.minIso && p.iso <= lim.maxIso;

  const build = (
    effect: TranslationKey,
    make: (thirds: number) => Partial<Alternative['patch']> | undefined,
  ): Alternative | undefined => {
    for (const thirds of [6, 3]) {
      const moved = make(thirds);
      if (!moved || Object.values(moved).some((v) => v === undefined)) continue;
      const patch = { aperture: s.aperture, shutter: s.shutter, iso: s.iso, ...moved };
      if (inRange(patch)) return { patch, effect };
    }
    return undefined;
  };

  const openUp = build('altMoreBlur', (n) => ({
    aperture: shift(APERTURES, s.aperture, -n), shutter: shift(SHUTTERS, s.shutter, n),
  }));
  const stopDown = build('altMoreDepth', (n) => ({
    aperture: shift(APERTURES, s.aperture, n), shutter: shift(SHUTTERS, s.shutter, -n),
  }));
  const isoTrade = s.iso <= 1600
    ? build('altFasterNoisier', (n) => ({ shutter: shift(SHUTTERS, s.shutter, n), iso: shift(ISOS, s.iso, n) }))
    : build('altCleaner', (n) => ({ shutter: shift(SHUTTERS, s.shutter, -n), iso: shift(ISOS, s.iso, -n) }));

  return [openUp, stopDown, isoTrade].filter((a): a is Alternative => a !== undefined);
}

function Pips({ share, colour }: { share: number; colour: string }) {
  const filled = Math.max(1, Math.min(5, Math.round(share * 5)));
  return (
    <span className="tri-pips" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ background: i < filled ? colour : 'transparent', borderColor: colour }} />
      ))}
    </span>
  );
}

export function ExposureTriangle({ settings: s, meter, sensor, noiseProfile, subjectSpeedPxPerS, limits, onApply }: Props) {
  const { t } = useI18n();

  const dof = depthOfField(s.focalMm, s.aperture, s.focusDistM, sensor);
  const blur = subjectBlurPx(subjectSpeedPxPerS, s.shutter);
  const shake = shakeAmount(s.shutter, s.focalMm, sensor, s.stabilisation);
  const noise = noiseAmount(s.iso, noiseProfile);

  const corners = [
    {
      key: 'aperture', label: t('aperture'), value: formatAperture(s.aperture),
      share: lightShare.aperture(s.aperture), colour: COLOURS.aperture,
      effect: t(dofEffect(dof.totalM === Infinity ? 1e4 : dof.totalM)), role: t('triRoleAperture'),
    },
    {
      key: 'shutter', label: t('shutterSpeed'), value: formatShutter(s.shutter),
      share: lightShare.shutter(s.shutter), colour: COLOURS.shutter,
      effect: t(motionEffect(blur, shake, subjectSpeedPxPerS > 0)), role: t('triRoleShutter'),
    },
    {
      key: 'iso', label: 'ISO', value: `${s.iso}`,
      share: lightShare.iso(s.iso), colour: COLOURS.iso,
      effect: t(noiseEffect(noise)), role: t('triRoleIso'),
    },
  ];

  const rounded = Math.round(meter * 10) / 10;
  const balanced = Math.abs(meter) <= 0.34;
  const verdict = balanced
    ? t('triangleBalanced')
    : t(meter > 0 ? 'triangleTooBright' : 'triangleTooDark').replace('{n}', Math.abs(rounded).toFixed(1));

  const alts = useMemo(() => (onApply ? alternatives(s, limits) : []), [s, limits, onApply]);
  const baseEv = settingsEV100({ aperture: s.aperture, shutter: s.shutter, iso: s.iso });

  return (
    <section className="tri card" aria-labelledby="tri-title" data-testid="exposure-triangle">
      <h2 id="tri-title" className="tri-title">{t('triangleTitle')}</h2>
      <p className="tri-caption">{t('triangleCaption')}</p>

      <div className="tri-body">
        <svg className="tri-svg" viewBox="0 0 300 250" aria-hidden="true" focusable="false">
          <path d="M150 34 L262 214 L38 214 Z" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" strokeLinejoin="round" />
          {/* Each edge is a trade: give light on one corner, take it on another. */}
          <text x="80" y="118" className="tri-edge" transform="rotate(-58 80 118)">{t('triEdgeApShutter')}</text>
          <text x="220" y="118" className="tri-edge" transform="rotate(58 220 118)">{t('triEdgeApIso')}</text>
          <text x="150" y="238" className="tri-edge">{t('triEdgeShutterIso')}</text>

          <text x="150" y="146" textAnchor="middle" className={`tri-verdict ${balanced ? 'ok' : meter > 0 ? 'over' : 'under'}`}>
            {balanced ? '●' : meter > 0 ? '▲' : '▼'}
          </text>
          <text x="150" y="168" textAnchor="middle" className="tri-verdict-text">{verdict}</text>

          {corners.map((c, i) => {
            const [x, y] = VERTICES[i] ?? [0, 0];
            return (
              <g key={c.key}>
                <circle cx={x} cy={y} r="30" fill={c.colour} />
                <text x={x} y={y + 5} textAnchor="middle" className="tri-value">{c.value}</text>
              </g>
            );
          })}
        </svg>

        <ul className="tri-legend">
          {corners.map((c) => (
            <li key={c.key}>
              <span className="tri-swatch" style={{ background: c.colour }} aria-hidden="true" />
              <div>
                <strong>{c.label} {c.value}</strong>
                <span className="tri-role">{c.role}</span>
                <span className="tri-line">
                  {t('triangleLight')} <Pips share={c.share} colour={c.colour} />
                  <span className="sr-only">{Math.round(c.share * 100)}%</span>
                </span>
                <span className="tri-line">→ {c.effect}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {alts.length > 0 && (
        <div className="tri-alts">
          <h3>{t('sameLightTitle')}</h3>
          <p className="tri-caption">{t('sameLightIntro')}</p>
          <ul>
            {alts.map((a) => {
              const delta = settingsEV100(a.patch) - baseEv;
              return (
                <li key={`${a.patch.aperture}-${a.patch.shutter}-${a.patch.iso}`}>
                  <span className="tri-alt-values">
                    {formatAperture(a.patch.aperture)} · {formatShutter(a.patch.shutter)} · ISO {a.patch.iso}
                    {Math.abs(delta) >= 0.17 && <small> ({delta > 0 ? '−' : '+'}{Math.abs(delta).toFixed(1)})</small>}
                  </span>
                  <span className="tri-alt-effect">{t(a.effect)}</span>
                  <button type="button" className="btn" onClick={() => onApply?.({ ...a.patch, mode: 'M', autoIso: false })}>
                    {t('tryThis')}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
