/**
 * Camera body and lens selection with the mount-compatibility engine.
 * Incompatible pairs cannot be selected; adapted pairs explain limitations.
 */
import { useMemo, useState } from 'react';
import {
  CAMERAS, checkCompatibility, lensById, compatibleLenses, gearLabel,
  isVariableAperture, CATALOGUE_DISCLAIMER,
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

export function GearPicker() {
  const { state, dispatch, camera, lens } = useStore();
  const { t } = useI18n();
  const [camQuery, setCamQuery] = useState('');
  const [lensQuery, setLensQuery] = useState('');

  const cams = useMemo(() => {
    const q = camQuery.trim().toLowerCase();
    return CAMERAS.filter((c) => !q || `${c.manufacturer} ${c.model} ${c.system}`.toLowerCase().includes(q));
  }, [camQuery]);

  const lensOptions = useMemo(() => {
    const q = lensQuery.trim().toLowerCase();
    return compatibleLenses(camera).filter(
      ({ lens: l }) => !q || `${l.manufacturer} ${l.model} ${l.category}`.toLowerCase().includes(q),
    );
  }, [camera, lensQuery]);

  const compat = checkCompatibility(lens, camera);

  return (
    <div className="card" data-testid="gear-picker">
      <h3>{t('camera')} &amp; {t('lens')}</h3>
      <p className="notice" style={{ fontSize: '0.82rem' }}>{t('educationalApprox')}</p>

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

      <label htmlFor="lens-search">{t('chooseLens')}</label>
      <input
        id="lens-search"
        type="search"
        placeholder={t('searchLenses')}
        value={lensQuery}
        onChange={(e) => setLensQuery(e.target.value)}
        style={{ width: '100%', margin: '0.3rem 0' }}
      />
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
            {l.id === camera.kitLensId ? ` — ${t('kitLens')}` : ''}
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
      {compat.status === 'native' && (
        <p className="notice success" role="status">{t('native')}: {lensById(state.lensId).model}</p>
      )}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>{t('independentNote').slice(0, 40)}…</summary>
        <p style={{ fontSize: '0.8rem', color: 'var(--fg-dim)' }}>{CATALOGUE_DISCLAIMER}</p>
      </details>
    </div>
  );
}
