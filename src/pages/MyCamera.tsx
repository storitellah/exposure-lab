/**
 * "Use My Camera": optional, permission-based live camera preview with a
 * clearly-labelled simulated exposure overlay. Nothing is uploaded; the
 * whole app keeps working if permission is refused. Users can upload an
 * existing photo instead (validated by file signature, decoded off-DOM).
 */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { stopsFromCorrect, brightnessMultiplier } from '../engine/exposure';
import { noiseAmount } from '../engine/noise';
import { verifyImageFile } from '../engine/sanitize';
import { ControlSlider } from '../components/ControlSlider';
import { APERTURES, SHUTTERS, ISOS, formatAperture, formatShutter } from '../engine/settings';

type CamState = 'idle' | 'active' | 'denied' | 'unavailable' | 'unsupported';

export default function MyCamera() {
  const { t } = useI18n();
  const { state, update } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<CamState>('idle');
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadError, setUploadError] = useState('');

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamState('idle');
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera starts ONLY after this explicit button press. Secure contexts only.
  const start = async (face: 'user' | 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCamState('unsupported');
      return;
    }
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face },
        audio: false, // microphone is never requested
      });
      streamRef.current = stream;
      setFacing(face);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState('active');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setCamState(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'denied');
    }
  };

  const onUpload = async (file: File | undefined) => {
    setUploadError('');
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setUploadError(t('uploadTooLarge'));
      return;
    }
    const kind = await verifyImageFile(file);
    if (!kind) {
      setUploadError(t('uploadUnsupported'));
      return;
    }
    try {
      // Decode away from the DOM to reject malformed files safely.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } catch {
      setUploadError(t('uploadUnsupported'));
      return;
    }
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    setUploadUrl(URL.createObjectURL(file));
  };

  const stops = stopsFromCorrect(11, {
    aperture: state.settings.aperture, shutter: state.settings.shutter,
    iso: state.settings.iso, ndStops: state.settings.ndStops,
  });
  const brightness = Math.max(0.15, Math.min(4, brightnessMultiplier(stops)));
  const grain = noiseAmount(state.settings.iso);
  const overlayFilter = `brightness(${brightness.toFixed(2)}) contrast(${(1 - grain * 0.3).toFixed(2)})`;

  return (
    <div className="content-page">
      <h1>{t('useMyCamera')}</h1>
      <p className="notice">{t('cameraPermissionIntro')}</p>
      <p className="notice warning">{t('simulatedOverlay')}</p>

      {camState !== 'active' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
          <button type="button" className="btn primary" data-testid="enable-camera" onClick={() => void start('environment')}>
            {t('enableCamera')}
          </button>
          <label className="btn">
            {t('uploadInstead')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              data-testid="upload-input"
              onChange={(e) => void onUpload(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {camState === 'denied' && <p className="notice error" role="alert" data-testid="camera-denied">{t('cameraDenied')}</p>}
      {camState === 'unavailable' && <p className="notice error" role="alert">{t('cameraUnavailable')}</p>}
      {camState === 'unsupported' && <p className="notice error" role="alert">{t('cameraUnsupported')}</p>}
      {uploadError && <p className="notice error" role="alert" data-testid="upload-error">{uploadError}</p>}

      <div className="viewfinder" style={{ marginBottom: '1rem' }}>
        {camState === 'active' && (
          <video ref={videoRef} playsInline muted style={{ width: '100%', filter: overlayFilter }} />
        )}
        {camState !== 'active' && uploadUrl && (
          <img src={uploadUrl} alt={t('uploadInstead')} style={{ width: '100%', filter: overlayFilter }} />
        )}
      </div>

      {camState === 'active' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className="btn" onClick={() => void start(facing === 'user' ? 'environment' : 'user')}>
            {facing === 'user' ? t('cameraBack') : t('cameraFront')}
          </button>
          <button type="button" className="btn danger" onClick={stop}>{t('stopCamera')}</button>
        </div>
      )}

      <div className="control-panel">
        <ControlSlider label={t('aperture')} values={APERTURES} value={state.settings.aperture} format={formatAperture} onChange={(v) => update({ aperture: v })} />
        <ControlSlider label={t('shutterSpeed')} values={[...SHUTTERS].reverse()} value={state.settings.shutter} format={formatShutter} onChange={(v) => update({ shutter: v })} />
        <ControlSlider label="ISO" values={ISOS} value={state.settings.iso} format={(v) => `${v}`} onChange={(v) => update({ iso: v })} />
      </div>
    </div>
  );
}
