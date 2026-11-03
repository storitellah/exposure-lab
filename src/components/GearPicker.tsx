/**
 * Camera body and lens selection with the mount-compatibility engine.
 * Lenses that suit the body are listed first; incompatible pairs cannot be
 * selected, and adapted pairs explain their limitations.
 */
import { useMemo, useState } from 'react';
import {
  CAMERAS, checkCompatibility, compatibleLenses, gearLabel, isFixedMount,
  isVariableAperture, type Compatibility, type LensProfile,
} from '../data/catalogue';
import { formatAperture } from '../engine/settings';
import { useStore } from '../state/store';
import { useI18n } from '../i18n';

const LIMIT_KEYS = {
  'manual-focus-only': 'limitManualFocus',
  'slower-af': 'limitSlowerAf',
  'no-electronic-control': 'limitNoElectronic',
  'crop-mode': 'limitCrop',
  'no-stabilisation-link': 'limitNoStab',
} as const;

const COMPAT_ORDER: Record<Compatibility['status'], number> = { native: 1, adapter: 2, incompatible: 3 };

export function GearPicker() {
  const { state, dispatch, camera, lens } = useStore();
  const { t } = useI18n();
  const [camQuery, setCamQuery] = useState('');
  const [lensQuery, setLensQuery] = useState('');

  const cams = useMemo(() => {
    const q = camQuery.trim().toLowerCase();
    return CAMERAS.filter((c) => !q || `${c.manufacturer} ${c.model} ${c.system}`.toLowerCase().includes(q));
  }, [camQuery]);

  const fixedBody = isFixedMount(camera.mount);

  const lensOptions = useMemo(() => {
    const q = lensQuery.trim().toLowerCase();
    const suggested = new Set([camera.kitLensId, ...(camera.suggestedLensIds ?? [])]);
    const rank = (l: LensProfile, cp: Compatibility) =>
      (suggested.has(l.id) ? 0 : COMPAT_ORDER[cp.status]);
    return compatibleLenses(camera)
      // A fixed-lens camera can only ever use its own lens; listing every
      // other lens as "not compatible" would just be noise.
      .filter(({ compat: cp }) => !fixedBody || cp.status !== 'incompatible')
      .filter(({ lens: l }) => !q || `${l.manufacturer} ${l.model} ${l.category}`.toLowerCase().includes(q))
      .sort((a, b) => rank(a.lens, a.compat) - rank(b.lens, b.compat));
  }, [camera, lensQuery, fixedBody]);

  const lensTag = (l: LensProfile): string => {
    if (l.id === camera.kitLensId) return ` — ${t(fixedBody ? 'builtInLens' : 'kitLens')}`;
    if (camera.suggestedLensIds?.includes(l.id)) return ` — ${t('suggestedLens')}`;
    return '';
  };

  const compat = checkCompatibility(lens, camera);

  return (
    <div className="card" data-testid="gear-picker">
      <h3>{t('camera')} &amp; {t('lens')}</h3>

      <label htmlFor="camera-search">{t('chooseCamera')}</label>
      <input
        id="camera-search"
        type="search"
        placeholder={t('searchCameras')}
        value={camQuery}
        onChange={(e) => setCamQuery(e.target.value)}
        style={{ width: '100%', margin: '0.3rem 0' }}
      />
      <select
        aria-label={t('chooseCamera')}
        data-testid="camera-select"
        value={state.cameraId}
        onChange={(e) => dispatch({ type: 'set-camera', id: e.target.value })}
        style={{ width: '100%' }}
        size={Math.min(6, Math.max(2, cams.length))}
      >
        {cams.map((c) => (
          <option key={c.id} value={c.id}>
            {gearLabel(c)} · {c.sensorFormat}
          </option>
        ))}
      </select>

      <p style={{ fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
        {t('sensorFormat')}: {camera.sensorFormat} · {t('cropFactor')}: {camera.cropFactor}× ·{' '}
        {t('isoRange')}: {camera.isoMin}–{camera.isoMax}
      </p>

      {!fixedBody && (
        <>
          <label htmlFor="lens-search">{t('chooseLens')}</label>
          <input
            id="lens-search"
            type="search"
            placeholder={t('searchLenses')}
            value={lensQuery}
            onChange={(e) => setLensQuery(e.target.value)}
            style={{ width: '100%', margin: '0.3rem 0' }}
          />
        </>
      )}
      <select
        aria-label={t('chooseLens')}
        data-testid="lens-select"
        value={state.lensId}
        onChange={(e) => dispatch({ type: 'set-lens', id: e.target.value })}
        style={{ width: '100%' }}
        size={Math.min(6, Math.max(2, lensOptions.length))}
      >
        {lensOptions.map(({ lens: l, compat: cp }) => (
          <option key={l.id} value={l.id} disabled={cp.status === 'incompatible'}>
            {gearLabel(l)}
            {lensTag(l)}
            {cp.status === 'incompatible' ? ` — ${t('incompatible')}` : cp.status === 'adapter' ? ` — ${t('viaAdapter')}` : ''}
          </option>
        ))}
      </select>

      {compat.status === 'adapter' && (
        <p className="notice warning" role="status" data-testid="adapter-note">
          {t('adapterNote')} <strong>{compat.adapter.name}</strong>
          {compat.adapter.limitations.length > 0 && (
            <> — {compat.adapter.limitations.map((l) => t(LIMIT_KEYS[l])).join(', ')}</>
          )}
        </p>
      )}
      {isVariableAperture(lens) && (
        <p className="notice" role="status" data-testid="variable-aperture-note">
          {t('variableApertureNote')
            .replace('{wide}', `${formatAperture(lens.maxAperture)} ${t('atFocal')} ${lens.minFocal}mm`)
            .replace('{tele}', `${formatAperture(lens.maxApertureTele ?? lens.maxAperture)} ${t('atFocal')} ${lens.maxFocal}mm`)}
        </p>
      )}
    </div>
  );
}
