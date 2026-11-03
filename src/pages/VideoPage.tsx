/**
 * Video Exposure Mode: frame rate and shutter angle, with a comparison of
 * how common frame-rate/shutter pairings render motion.
 */
import { useState } from 'react';
import { Simulator } from '../components/Simulator';
import { GearPicker } from '../components/GearPicker';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { gearLabel } from '../data/catalogue';
import { CADENCE_PAIRS, motionCadence, angleFromShutter, formatAngle } from '../engine/video';
import { formatShutter } from '../engine/settings';

function cadenceLabel(c: number, t: (k: 'cadenceCrisp' | 'cadenceNatural' | 'cadenceSmeared') => string): string {
  if (c < 0.4) return t('cadenceCrisp');
  if (c > 0.6) return t('cadenceSmeared');
  return t('cadenceNatural');
}

export default function VideoPage() {
  const { t } = useI18n();
  const { camera, lens } = useStore();
  const [showGear, setShowGear] = useState(false);

  return (
    <div>
      <h1>{t('videoSimulator')}</h1>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={() => setShowGear(!showGear)} aria-expanded={showGear}>
          🎥 {t('camera')} &amp; {t('lens')}
        </button>
        <span style={{ fontSize: '0.9rem', color: 'var(--fg-dim)' }}>
          {gearLabel(camera)} · {t('baseIso')} {camera.baseIso}
          {camera.dualNativeIso ? ` / ${camera.dualNativeIso}` : ''}
          {camera.logProfiles.length ? ` · ${camera.logProfiles.join(', ')}` : ''}
          {lens.tStop ? ` · T${lens.tStop}` : ''}
          {lens.anamorphicSqueeze > 1 ? ` · ${lens.anamorphicSqueeze}× ${t('desqueeze')}` : ''}
        </span>
      </div>

      {showGear && <div style={{ marginBottom: '1rem' }}><GearPicker /></div>}

      <Simulator video allowedControls={['aperture', 'iso', 'evComp', 'focal', 'focus', 'advanced']} />

      <section style={{ marginTop: '1.2rem' }}>
        <h2>{t('cadenceCompare')}</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('frameRate')}</th>
                <th>{t('shutterSpeed')}</th>
                <th>{t('shutterAngle')}</th>
                <th>{t('motionLook')}</th>
              </tr>
            </thead>
            <tbody>
              {CADENCE_PAIRS.map((pair) => (
                <tr key={pair.label}>
                  <td>{pair.fps} fps</td>
                  <td>{formatShutter(pair.shutter)}</td>
                  <td>{formatAngle(Math.round(angleFromShutter(pair.shutter, pair.fps) * 10) / 10)}</td>
                  <td>{cadenceLabel(motionCadence(pair.shutter, pair.fps), t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
