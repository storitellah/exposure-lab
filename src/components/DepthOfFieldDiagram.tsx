/**
 * Depth of field, seen from the side.
 *
 * A distance scale runs from the camera out to infinity (logarithmic, so
 * close-up and far-away both fit). The green band is the sharp zone; the
 * dashed line is where the lens is focused; the subject and the background
 * sit at their real distances, each with a blur disc drawn to the size the
 * renderer would give it. Change focus, aperture, focal length or sensor and
 * the band, the discs and the numbers move together.
 */
import { useId } from 'react';
import { depthOfField, type SensorFormat } from '../engine/optics';
import { backgroundBlurPx } from '../engine/tradeoffs';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';

const W = 640;
const H = 222;
const LEFT = 64;
const RIGHT = W - 40;      // x of "∞"
const GROUND = 150;
const MIN_D = 0.25;
const MAX_D = 300;

function x(d: number): number {
  if (!Number.isFinite(d) || d >= MAX_D) return RIGHT;
  const t = (Math.log(Math.max(d, MIN_D)) - Math.log(MIN_D)) / (Math.log(MAX_D) - Math.log(MIN_D));
  return LEFT + t * (RIGHT - 12 - LEFT);
}

export function formatDistance(d: number): string {
  if (!Number.isFinite(d) || d >= 1000) return '∞';
  if (d < 1) return `${Math.round(d * 100)} cm`;
  if (d < 10) return `${d.toFixed(1)} m`;
  return `${Math.round(d)} m`;
}

export function sharpnessKey(blurPx: number): TranslationKey {
  if (blurPx < 1) return 'dofInFocus';
  if (blurPx < 3) return 'dofSlightlySoft';
  if (blurPx < 8) return 'dofSoft';
  return 'dofVerySoft';
}

const TICKS = [0.5, 1, 2, 5, 10, 20, 50, 100];

export interface DepthOfFieldDiagramProps {
  focalMm: number;
  aperture: number;
  focusDistM: number;
  sensor: SensorFormat;
  subjectDistM: number;
  backgroundDistM: number;
}

export function DepthOfFieldDiagram(p: DepthOfFieldDiagramProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dof = depthOfField(p.focalMm, p.aperture, p.focusDistM, p.sensor);
  const subjectBlur = backgroundBlurPx(p.focalMm, p.aperture, p.focusDistM, p.subjectDistM, p.sensor);
  const bgBlur = backgroundBlurPx(p.focalMm, p.aperture, p.focusDistM, p.backgroundDistM, p.sensor);
  const nearX = x(dof.nearM);
  const farX = x(dof.farM);
  const focusX = x(p.focusDistM);
  const subjectX = x(p.subjectDistM);
  const bgX = x(p.backgroundDistM);
  const disc = (px: number) => Math.max(1.5, Math.min(24, px * 1.4));

  const zone = Number.isFinite(dof.farM)
    ? `${formatDistance(dof.nearM)} – ${formatDistance(dof.farM)} (${formatDistance(dof.totalM)})`
    : `${formatDistance(dof.nearM)} – ∞`;

  return (
    <figure className="dofd" data-testid="dof-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {`${t('dofSharpZone')}: ${zone}. ${t('dofFocus')} ${formatDistance(p.focusDistM)}. ${t('dofSubject')}: ${t(sharpnessKey(subjectBlur))}. ${t('dofBackground')}: ${t(sharpnessKey(bgBlur))}.`}
        </title>

        {/* Sharp zone */}
        <rect x={nearX} y={22} width={Math.max(2, farX - nearX)} height={GROUND - 22} className="dofd-zone" rx="4" />
        <text x={(nearX + Math.min(farX, RIGHT)) / 2} y={17} className="dofd-zone-label" textAnchor="middle">{t('dofSharpZone')}</text>

        {/* Ground and distance scale */}
        <line x1={LEFT - 30} y1={GROUND} x2={RIGHT + 14} y2={GROUND} className="dofd-ground" />
        {TICKS.map((d) => (
          <g key={d}>
            <line x1={x(d)} y1={GROUND} x2={x(d)} y2={GROUND + 6} className="dofd-tick" />
            <text x={x(d)} y={GROUND + 22} className="dofd-scale" textAnchor="middle">{d < 1 ? `${d * 100}cm` : `${d}m`}</text>
          </g>
        ))}
        <text x={RIGHT} y={GROUND + 22} className="dofd-scale" textAnchor="middle">∞</text>

        {/* Camera */}
        <g className="dofd-camera" transform={`translate(${LEFT - 50} ${GROUND - 34})`}>
          <rect x="0" y="6" width="30" height="22" rx="4" />
          <rect x="8" y="2" width="10" height="6" rx="1.5" />
          <rect x="30" y="11" width="10" height="12" rx="2" />
        </g>

        {/* Focus plane */}
        <line x1={focusX} y1={26} x2={focusX} y2={GROUND} className="dofd-focus" />
        <text x={focusX} y={GROUND + 42} className="dofd-focus-label" textAnchor="middle">
          {t('dofFocus')} {formatDistance(p.focusDistM)}
        </text>

        {/* Hyperfocal marker */}
        {dof.hyperfocalM < MAX_D && (
          <g>
            <line x1={x(dof.hyperfocalM)} y1={GROUND - 8} x2={x(dof.hyperfocalM)} y2={GROUND} className="dofd-hyper" />
            <text x={x(dof.hyperfocalM)} y={GROUND - 12} className="dofd-hyper-label" textAnchor="middle">H</text>
          </g>
        )}

        {/* Background: a tree, with its blur disc */}
        <g transform={`translate(${bgX} ${GROUND})`} className="dofd-bg">
          <rect x="-2.5" y="-26" width="5" height="26" />
          <circle cx="0" cy="-38" r="16" />
        </g>
        <circle cx={bgX} cy={GROUND - 38} r={disc(bgBlur)} className="dofd-disc" />

        {/* Subject: a person, with its blur disc */}
        <g transform={`translate(${subjectX} ${GROUND})`} className="dofd-subject">
          <circle cx="0" cy="-50" r="7" />
          <path d="M-8 -40 h16 v22 h-4 v18 h-8 v-18 h-4 z" />
        </g>
        {subjectBlur >= 1 && <circle cx={subjectX} cy={GROUND - 50} r={disc(subjectBlur)} className="dofd-disc subject" />}
      </svg>

      <figcaption className="dofd-stats">
        <span><strong>{t('dofSharpZone')}</strong> {zone}</span>
        <span><strong>{t('dofSubject')}</strong> {t(sharpnessKey(subjectBlur))}</span>
        <span>
          <strong>{t('dofBackground')}</strong> {t(sharpnessKey(bgBlur))}
          <small> · {t('dofBlurDisc')} {bgBlur.toFixed(1)} px</small>
        </span>
        <span><strong>{t('dofHyperfocal')}</strong> {formatDistance(dof.hyperfocalM)}</span>
      </figcaption>
    </figure>
  );
}
