/**
 * Connect a camera.
 *
 * Shows a live picture from any video device the browser can see: a camera in
 * its USB-C webcam/streaming mode, a camera's HDMI output through an
 * HDMI-to-USB capture device, or a built-in webcam or phone camera.
 *
 * Settings are offered only where the connected device really exposes them to
 * the browser (exposure time, ISO, compensation, focus, white balance, zoom),
 * read from the device's own capabilities. Browsers cannot set a lens
 * aperture over any connection, and HDMI carries no control signal at all,
 * so neither is pretended.
 *
 * Permission is requested only when the user presses Connect; nothing is
 * recorded or uploaded. A photo upload remains as a no-camera alternative.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { settingsEV100, brightnessMultiplier } from '../engine/exposure';
import { noiseAmount } from '../engine/noise';
import { verifyImageFile } from '../engine/sanitize';
import { ControlSlider } from '../components/ControlSlider';
import { APERTURES, SHUTTERS, ISOS, formatAperture, formatShutter } from '../engine/settings';

type CamState = 'idle' | 'connecting' | 'active' | 'denied' | 'unavailable' | 'unsupported' | 'disconnected';

/** Range capability as defined by the Media Capture Image specification. */
interface Range { min: number; max: number; step?: number }

/**
 * Camera controls from W3C Media Capture Image. TypeScript's DOM library does
 * not declare them yet. Note exposureTime is in units of 100 microseconds.
 */
interface CameraCapabilities {
  exposureMode?: string[];
  exposureTime?: Range;
  exposureCompensation?: Range;
  iso?: Range;
  focusMode?: string[];
  focusDistance?: Range;
  whiteBalanceMode?: string[];
  colorTemperature?: Range;
  zoom?: Range;
}
type CameraSettings = Partial<Record<'exposureTime' | 'exposureCompensation' | 'iso' | 'focusDistance' | 'colorTemperature' | 'zoom', number>>
  & { exposureMode?: string; focusMode?: string; whiteBalanceMode?: string };

const EXPOSURE_UNIT_S = 1e-4;

function readCapabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return typeof track.getCapabilities === 'function'
      ? (track.getCapabilities() as unknown as CameraCapabilities)
      : {};
  } catch {
    return {};
  }
}

function readSettings(track: MediaStreamTrack): CameraSettings {
  try { return track.getSettings() as unknown as CameraSettings; } catch { return {}; }
}

export default function MyCamera() {
  const { t } = useI18n();
  const { state, update } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camState, setCamState] = useState<CamState>('idle');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [caps, setCaps] = useState<CameraCapabilities>({});
  const [live, setLive] = useState<CameraSettings>({});
  const [controlError, setControlError] = useState('');
  const [simulate, setSimulate] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadError, setUploadError] = useState('');

  const track = stream?.getVideoTracks()[0];

  // Attach the stream to the <video>. The element is always rendered, so the
  // picture appears as soon as the stream exists.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);

  // Stop the camera when leaving the page.
  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream]);
  useEffect(() => () => { if (uploadUrl) URL.revokeObjectURL(uploadUrl); }, [uploadUrl]);

  const listDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'videoinput'));
    } catch {
      setDevices([]);
    }
  }, []);

  // Plugging in a camera or capture device refreshes the source list.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    md.addEventListener('devicechange', listDevices);
    return () => md.removeEventListener('devicechange', listDevices);
  }, [listDevices]);

  /** Permission is requested here and only here — on a button press. */
  const connect = async (id?: string) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCamState('unsupported');
      return;
    }
    setCamState('connecting');
    setControlError('');
    try {
      stream?.getTracks().forEach((tr) => tr.stop());
      const next = await navigator.mediaDevices.getUserMedia({
        video: id
          ? { deviceId: { exact: id }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false, // the microphone is never requested
      });
      const tr = next.getVideoTracks()[0];
      if (tr) {
        tr.addEventListener('ended', () => {
          setStream(null);
          setCamState('disconnected');
        });
        setCaps(readCapabilities(tr));
        setLive(readSettings(tr));
        setDeviceId(tr.getSettings().deviceId ?? '');
      }
      setStream(next);
      setCamState('active');
      await listDevices(); // labels become readable once permission is granted
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setCamState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' ? 'unavailable'
          : 'denied');
    }
  };

  const disconnect = () => {
    stream?.getTracks().forEach((tr) => tr.stop());
    setStream(null);
    setCaps({});
    setCamState('idle');
  };

  /** Send a setting to the real device, then read back what it accepted. */
  const apply = async (constraint: Record<string, number | string>) => {
    if (!track) return;
    setControlError('');
    try {
      await track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
      setLive(readSettings(track));
    } catch {
      setControlError(t('liveControlRejected'));
    }
  };

  const onUpload = async (file: File | undefined) => {
    setUploadError('');
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setUploadError(t('uploadTooLarge'));
      return;
    }
    if (!(await verifyImageFile(file))) {
      setUploadError(t('uploadUnsupported'));
      return;
    }
    try {
      // Decode off the DOM first so malformed files are rejected safely.
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } catch {
      setUploadError(t('uploadUnsupported'));
      return;
    }
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    setUploadUrl(URL.createObjectURL(file));
    enableSimulation(true);
  };

  // Simulated exposure. The real scene's brightness is unknown, so the
  // camera's own picture is taken as correctly exposed at the moment the
  // simulation is switched on; changing the simulated settings then brightens
  // or darkens it by exactly the stops that change would add or remove.
  const currentEv = settingsEV100({
    aperture: state.settings.aperture, shutter: state.settings.shutter,
    iso: state.settings.iso, ndStops: state.settings.ndStops,
  });
  const [refEv, setRefEv] = useState(currentEv);
  const enableSimulation = (on: boolean) => {
    if (on) setRefEv(currentEv);
    setSimulate(on);
  };
  const brightness = Math.max(0.05, Math.min(8, brightnessMultiplier(refEv - currentEv)));
  const grain = noiseAmount(state.settings.iso);
  const simFilter = `brightness(${brightness.toFixed(2)}) contrast(${(1 - grain * 0.3).toFixed(2)})`;
  const filter = simulate ? simFilter : 'none';

  const manualExposure = caps.exposureMode?.includes('manual') ?? false;
  const manualFocus = caps.focusMode?.includes('manual') ?? false;
  const manualWb = caps.whiteBalanceMode?.includes('manual') ?? false;
  const controls = [
    manualExposure && caps.exposureTime,
    caps.iso,
    caps.exposureCompensation,
    manualFocus && caps.focusDistance,
    manualWb && caps.colorTemperature,
    caps.zoom,
  ].filter(Boolean);

  return (
    <div className="content-page">
      <h1>{t('useMyCamera')}</h1>
      <p>{t('connectIntro')}</p>

      <details className="card" style={{ marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('connectHowTitle')}</summary>
        <ul style={{ marginBottom: 0 }}>
          <li>{t('connectUsb')}</li>
          <li>{t('connectHdmi')}</li>
          <li>{t('connectLimits')}</li>
        </ul>
      </details>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        {camState !== 'active' ? (
          <button
            type="button"
            className="btn primary"
            data-testid="enable-camera"
            disabled={camState === 'connecting'}
            onClick={() => void connect(deviceId || undefined)}
          >
            {t('enableCamera')}
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={disconnect}>{t('stopCamera')}</button>
        )}
        {devices.length > 1 && (
          <label>
            {t('videoSource')}{' '}
            <select
              value={deviceId}
              data-testid="video-source"
              onChange={(e) => { setDeviceId(e.target.value); void connect(e.target.value); }}
            >
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${t('camera')} ${i + 1}`}</option>
              ))}
            </select>
          </label>
        )}
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

      {camState === 'denied' && <p className="notice error" role="alert" data-testid="camera-denied">{t('cameraDenied')}</p>}
      {camState === 'unavailable' && <p className="notice error" role="alert">{t('cameraUnavailable')}</p>}
      {camState === 'unsupported' && <p className="notice error" role="alert">{t('cameraUnsupported')}</p>}
      {camState === 'disconnected' && <p className="notice warning" role="alert">{t('cameraDisconnected')}</p>}
      {uploadError && <p className="notice error" role="alert" data-testid="upload-error">{uploadError}</p>}

      <div className="viewfinder live-view" style={{ marginBottom: '0.6rem' }} hidden={!stream && !uploadUrl}>
        <video
          ref={videoRef}
          playsInline
          muted
          data-testid="live-preview"
          aria-label={t('livePreview')}
          hidden={!stream}
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter }}
        />
        {!stream && uploadUrl && (
          <img src={uploadUrl} alt={t('uploadInstead')} style={{ width: '100%', height: '100%', objectFit: 'contain', filter }} />
        )}
      </div>

      {(stream || uploadUrl) && (
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="checkbox" checked={simulate} onChange={(e) => enableSimulation(e.target.checked)} data-testid="simulate-toggle" />
          {t('showSimulation')}
        </label>
      )}

      {stream && (
        <section className="card" style={{ marginBottom: '1rem' }} data-testid="live-controls">
          <h2>{t('liveControls')}</h2>
          {controls.length === 0 ? (
            <p data-testid="no-live-controls">{t('noLiveControls')}</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {manualExposure && caps.exposureTime && (
                <LiveRange
                  label={t('shutterSpeed')}
                  range={caps.exposureTime}
                  value={live.exposureTime}
                  format={(v) => formatShutter(v * EXPOSURE_UNIT_S)}
                  logScale
                  onChange={(v) => void apply({ exposureMode: 'manual', exposureTime: v })}
                />
              )}
              {caps.iso && (
                <LiveRange label="ISO" range={caps.iso} value={live.iso} format={(v) => `${Math.round(v)}`} logScale
                  onChange={(v) => void apply({ exposureMode: 'manual', iso: v })} />
              )}
              {caps.exposureCompensation && (
                <LiveRange label={t('evComp')} range={caps.exposureCompensation} value={live.exposureCompensation}
                  format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                  onChange={(v) => void apply({ exposureCompensation: v })} />
              )}
              {manualFocus && caps.focusDistance && (
                <LiveRange label={t('focusDistance')} range={caps.focusDistance} value={live.focusDistance}
                  format={(v) => `${v.toFixed(2)} m`}
                  onChange={(v) => void apply({ focusMode: 'manual', focusDistance: v })} />
              )}
              {manualWb && caps.colorTemperature && (
                <LiveRange label={t('whiteBalance')} range={caps.colorTemperature} value={live.colorTemperature}
                  format={(v) => `${Math.round(v)} K`}
                  onChange={(v) => void apply({ whiteBalanceMode: 'manual', colorTemperature: v })} />
              )}
              {caps.zoom && (
                <LiveRange label={t('zoom')} range={caps.zoom} value={live.zoom} format={(v) => `${v.toFixed(1)}×`}
                  onChange={(v) => void apply({ zoom: v })} />
              )}
              {(manualExposure || manualFocus || manualWb) && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void apply({
                    ...(manualExposure ? { exposureMode: 'continuous' } : {}),
                    ...(manualFocus ? { focusMode: 'continuous' } : {}),
                    ...(manualWb ? { whiteBalanceMode: 'continuous' } : {}),
                  })}
                >
                  {t('liveBackToAuto')}
                </button>
              )}
            </div>
          )}
          {controlError && <p className="notice error" role="alert">{controlError}</p>}
          <p className="tri-caption" style={{ marginTop: '0.8rem', marginBottom: 0 }}>{t('liveNoAperture')}</p>
        </section>
      )}

      {simulate && (
        <section className="card">
          <h2>{t('simulatedSettings')}</h2>
          <p className="tri-caption">{t('simulatedOverlay')}</p>
          <div className="control-panel">
            <ControlSlider label={t('aperture')} values={APERTURES} value={state.settings.aperture} format={formatAperture} onChange={(v) => update({ aperture: v })} />
            <ControlSlider label={t('shutterSpeed')} values={[...SHUTTERS].reverse()} value={state.settings.shutter} format={formatShutter} onChange={(v) => update({ shutter: v })} />
            <ControlSlider label="ISO" values={ISOS} value={state.settings.iso} format={(v) => `${v}`} onChange={(v) => update({ iso: v })} />
          </div>
        </section>
      )}
    </div>
  );
}

/** A slider for one real device setting, using the device's own range. */
function LiveRange({ label, range, value, format, onChange, logScale = false }: {
  label: string;
  range: Range;
  value: number | undefined;
  format: (v: number) => string;
  onChange: (v: number) => void;
  logScale?: boolean;
}) {
  const steps = 100;
  const min = range.min;
  const max = range.max;
  const useLog = logScale && min > 0;
  const toPos = (v: number) => (useLog
    ? (Math.log(v / min) / Math.log(max / min)) * steps
    : ((v - min) / (max - min || 1)) * steps);
  const fromPos = (p: number) => {
    const raw = useLog ? min * Math.pow(max / min, p / steps) : min + ((max - min) * p) / steps;
    const step = range.step && range.step > 0 ? range.step : 0;
    return step ? Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min)) : raw;
  };
  const current = value ?? min;
  const id = useId();
  return (
    <div className="control-row">
      <label className="control-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={steps}
        value={Math.round(toPos(current))}
        aria-valuetext={format(current)}
        onChange={(e) => onChange(fromPos(Number(e.target.value)))}
      />
      <output className="control-value" htmlFor={id}>{format(current)}</output>
    </div>
  );
}
