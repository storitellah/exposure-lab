/**
 * Video Exposure Mode: frame rate & shutter angle controls, motion cadence
 * comparison, waveform, zebras, false colour and aspect guides.
 */
import { useState } from 'react';
import { Simulator } from '../components/Simulator';
import { GearPicker } from '../components/GearPicker';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { gearLabel } from '../data/catalogue';
import { CADENCE_PAIRS, motionCadence, angleFromShutter, formatAngle } from '../engine/video';
import { formatShutter } from '../engine/settings';

export default function VideoPage() {
  const { t } = useI18n();
  const { state, camera, lens } = useStore();
  const [showGear, setShowGear] = useState(false);
  const [monitorTools, setMonitorTools] = useState<string[]>([]);

  const toggleTool = (tool: string) =>
    setMonitorTools((tools) => (tools.includes(tool) ? tools.filter((x) => x !== tool) : [...tools, tool]));

  const cadence = motionCadence(state.settings.shutter, 24);

  return (
    <div>
      <h1>{t('videoSimulator')}</h1>
      <p className="notice">{t('angleRule')} {t('educationalApprox')}</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <button type="button" className="btn" onClick={() => setShowGear(!showGear)}>
          🎥 {t('camera')} &amp; {t('lens')}
        </button>
        {(['waveform', 'zebras', 'falseColour', 'focusPeaking', 'aspectGuides'] as const).map((tool) => (
          <button
            key={tool}
            type="button"
            className="btn"
            aria-pressed={monitorTools.includes(tool)}
            onClick={() => toggleTool(tool)}
          >
            {t(tool)}
          </button>
        ))}
      </div>

      {showGear && <div style={{ marginBottom: '1rem' }}><GearPicker /></div>}

      <div className="card" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <strong>{gearLabel(camera)}</strong> · {t('baseIso')}: {camera.baseIso}
        {camera.dualNativeIso ? ` · ${t('dualNativeIso')}: ${camera.baseIso}/${camera.dualNativeIso}` : ''}
        {' · '}{t('resolution')}: {camera.videoRes.join(', ') || '—'}
        {' · '}{t('logProfile')}: {camera.logProfiles.join(', ') || '—'}
        {' · '}{t('codec')}: {camera.videoRes.length ? 'H.265 / ProRes (educational label)' : '—'}
        {lens.tStop ? ` · ${t('tStop')}: T${lens.tStop}` : ''}
        {lens.anamorphicSqueeze > 1 ? ` · ${t('desqueeze')}: ${lens.anamorphicSqueeze}×` : ''}
      </div>

      <Simulator video allowedControls={['aperture', 'iso', 'evComp', 'focal', 'focus', 'advanced']} />

      {monitorTools.length > 0 && (
        <p className="notice" role="status">
          {monitorTools.map((tool) => t(tool as 'waveform')).join(' · ')} — {t('educationalApprox')}
        </p>
      )}

      <section style={{ marginTop: '1.2rem' }}>
        <h2>{t('cadenceCompare')}</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('frameRate')}</th>
                <th>{t('shutterSpeed')}</th>
                <th>{t('shutterAngle')}</th>
                <th>Motion</th>
              </tr>
            </thead>
            <tbody>
              {CADENCE_PAIRS.map((pair) => {
                const angle = angleFromShutter(pair.shutter, pair.fps);
                const c = motionCadence(pair.shutter, pair.fps);
                return (
                  <tr key={pair.label}>
                    <td>{pair.fps} fps</td>
                    <td>{formatShutter(pair.shutter)}</td>
                    <td>{formatAngle(Math.round(angle * 10) / 10)}</td>
                    <td>{c < 0.4 ? 'Crisp / staccato' : c > 0.6 ? 'Smeared / dreamy' : 'Natural'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.9rem' }}>
          Current 24 fps cadence: {cadence < 0.4 ? 'staccato' : cadence > 0.6 ? 'smeared' : 'natural'} —{' '}
          {formatAngle(Math.round(angleFromShutter(state.settings.shutter, 24)))} at {formatShutter(state.settings.shutter)}.
        </p>
      </section>
    </div>
  );
}
