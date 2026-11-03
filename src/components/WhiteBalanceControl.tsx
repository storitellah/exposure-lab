/**
 * White balance: preset or custom Kelvin, a warm-to-cool bar showing the
 * scene's light against what the camera is set to expect, and a plain
 * explanation of the resulting colour cast — plus what each preset is for and
 * a "What is white balance?" explainer, in plain words and in depth.
 */
import { useId, useMemo } from 'react';
import type { WhiteBalance } from '../engine/settings';
import {
  KELVIN_RANGE, blackbodyRgb, cameraWhiteBalance, castKind, mired, whiteBalanceShift,
  type SceneLight,
} from '../engine/whitebalance';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { ControlSlider } from './ControlSlider';
import { Link } from '../router';
import { wbTerm, WB_SETTING_TERM, WB_EXPLAINER_TERMS } from '../data/glossary-wb';
import type { GlossaryEntry } from '../data/glossary-core';

const KELVINS: number[] = [];
for (let k = KELVIN_RANGE.min; k <= KELVIN_RANGE.max; k += KELVIN_RANGE.step) KELVINS.push(k);

const PRESETS: { value: WhiteBalance; key: TranslationKey }[] = [
  { value: 'auto', key: 'wbAuto' },
  { value: 'tungsten', key: 'wbTungsten' },
  { value: 'fluorescent', key: 'wbFluorescent' },
  { value: 'daylight', key: 'wbDaylight' },
  { value: 'flash', key: 'wbFlash' },
  { value: 'cloudy', key: 'wbCloudy' },
  { value: 'shade', key: 'wbShade' },
  { value: 'custom', key: 'wbCustom' },
];


const CAST_KEYS = {
  neutral: 'wbNeutral', warm: 'wbWarm', veryWarm: 'wbVeryWarm', cool: 'wbCool', veryCool: 'wbVeryCool',
} as const satisfies Record<string, TranslationKey>;

/** Where a Kelvin value sits on the bar: mired scale, warm (left) to cool (right). */
function position(k: number): number {
  const lo = mired(KELVIN_RANGE.min);
  const hi = mired(KELVIN_RANGE.max);
  return Math.min(1, Math.max(0, (lo - mired(k)) / (lo - hi)));
}

function lightNameKey(k: number): TranslationKey {
  if (k < 3600) return 'lightWarmBulb';
  if (k < 4600) return 'lightLowSun';
  if (k < 6200) return 'lightDaylight';
  if (k < 7200) return 'lightOvercast';
  return 'lightShade';
}

const BAR_GRADIENT = (() => {
  const stops = [2500, 3000, 3500, 4500, 5500, 6500, 8000, 10000].map((k) => {
    const [r, g, b] = blackbodyRgb(k);
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${(position(k) * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
})();

export function WhiteBalanceControl(props: {
  value: WhiteBalance;
  kelvin: number;
  light: SceneLight;
  onChange: (patch: { whiteBalance?: WhiteBalance; wbKelvin?: number }) => void;
}) {
  const { t, pick } = useI18n();
  const presetTerm = wbTerm(WB_SETTING_TERM[props.value]);
  const selectId = useId();
  const camera = useMemo(() => cameraWhiteBalance(props.value, props.kelvin, props.light), [props.value, props.kelvin, props.light]);
  const shift = useMemo(() => whiteBalanceShift(props.light, camera), [props.light, camera]);
  const cast = castKind(shift.mired);
  const lightK = Math.round(props.light.kelvin / 100) * 100;
  const cameraK = Math.round(camera.kelvin / 100) * 100;

  return (
    <section className="wb" aria-labelledby={`${selectId}-title`} data-testid="white-balance">
      <div className="wb-head">
        <h3 id={`${selectId}-title`}>{t('whiteBalance')}</h3>
        <select
          id={selectId}
          aria-label={t('whiteBalance')}
          value={props.value}
          onChange={(e) => props.onChange({ whiteBalance: e.target.value as WhiteBalance })}
          data-testid="wb-select"
        >
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{t(p.key)}</option>)}
        </select>
      </div>

      {presetTerm && <p className="wb-preset-note" data-testid="wb-preset-note">{pick(presetTerm.simple)}</p>}

      {props.value === 'custom' && (
        <ControlSlider
          label={t('wbKelvin')}
          values={KELVINS}
          value={props.kelvin}
          format={(v) => `${v}K`}
          onChange={(v) => props.onChange({ wbKelvin: v })}
          disabled={false}
        />
      )}

      <div className="wb-bar" aria-hidden="true">
        <div className="wb-gradient" style={{ background: BAR_GRADIENT }} />
        <span className="wb-mark light" style={{ left: `${position(props.light.kelvin) * 100}%` }}>☀</span>
        <span className="wb-mark camera" style={{ left: `${position(camera.kelvin) * 100}%` }}>◆</span>
        <div className="wb-ends"><span>{t('wbWarmEnd')}</span><span>{t('wbCoolEnd')}</span></div>
      </div>
      <dl className="wb-readout">
        <div><dt>☀ {t('wbLightHere')}</dt><dd>≈ {lightK}K · {t(lightNameKey(props.light.kelvin))}</dd></div>
        <div><dt>◆ {t('wbCameraSet')}</dt><dd>{cameraK}K</dd></div>
      </dl>
      <p className={`wb-verdict ${cast}`} role="status" data-testid="wb-verdict">
        {t(CAST_KEYS[cast])}
        {shift.tint > 0.15 && <> {t('wbGreen')}</>}
        {shift.tint < -0.15 && <> {t('wbMagenta')}</>}
        {props.value === 'auto' && cast !== 'neutral' && <> {t('wbAutoKeeps')}</>}
      </p>

      <details className="wb-explainer" data-testid="wb-explainer">
        <summary>{t('wbWhatIs')}</summary>
        {WB_EXPLAINER_TERMS.map((id) => wbTerm(id)).filter((e): e is GlossaryEntry => !!e).map((e) => (
          <div key={e.id} className="wb-term">
            <h4>{pick(e.term)}</h4>
            <p><span className="glossary-label">{t('glossaryPlain')}</span> {pick(e.simple)}</p>
            <p><span className="glossary-label depth">{t('glossaryDepth')}</span> {pick(e.advanced)}</p>
          </div>
        ))}
        {presetTerm && props.value !== 'custom' && (
          <div className="wb-term">
            <h4>{pick(presetTerm.term)}</h4>
            <p><span className="glossary-label depth">{t('glossaryDepth')}</span> {pick(presetTerm.advanced)}</p>
          </div>
        )}
        <p><Link to="/glossary#gloss-cat-wb">{t('wbMoreTerms')}</Link></p>
      </details>
    </section>
  );
}
