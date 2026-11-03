/** Free Simulator Mode: every control available, plus gear selection. */
import { useState } from 'react';
import { Simulator } from '../components/Simulator';
import { GearPicker } from '../components/GearPicker';
import { useI18n } from '../i18n';
import { Link } from '../router';

export default function SimulatorPage() {
  const { t } = useI18n();
  const [showGear, setShowGear] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  return (
    <div>
      <h1>{t('freeMode')}</h1>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <button type="button" className="btn" data-testid="toggle-gear" onClick={() => setShowGear(!showGear)}>
          📷 {t('camera')} &amp; {t('lens')}
        </button>
        <button type="button" className="btn" onClick={() => setShowKeys(!showKeys)}>⌨ {t('keyboardHelp')}</button>
        <Link to="/my-camera" className="btn">🔌 {t('useMyCamera')}</Link>
      </div>

      {showGear && <div style={{ marginBottom: '1rem' }}><GearPicker /></div>}
      {showKeys && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2>{t('keyboardHelp')}</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Key</th><th>Action</th></tr></thead>
              <tbody>
                <tr><td>A / Z</td><td>{t('aperture')} + / −</td></tr>
                <tr><td>S / X</td><td>{t('shutterSpeed')} + / −</td></tr>
                <tr><td>I / K</td><td>ISO + / −</td></tr>
                <tr><td>← → ↑ ↓</td><td>{t('focusPoint')}</td></tr>
                <tr><td>Space</td><td>{t('takePhoto')}</td></tr>
                <tr><td>G</td><td>{t('gallery')}</td></tr>
                <tr><td>P</td><td>{t('printStudio')}</td></tr>
                <tr><td>H</td><td>{t('help')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Simulator />
    </div>
  );
}
