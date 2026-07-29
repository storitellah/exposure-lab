/** Print Studio: print photographs, contact sheets, worksheets, certificates. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRINT_FORMATS } from '../engine/printsizes';
import { createUrls, revokeUrls, type UrlMap } from '../utils/objectUrls';
import { listShots, type StoredShot } from '../state/db';
import { useI18n } from '../i18n';
import { useRouter, Link } from '../router';
import { useStore } from '../state/store';
import { formatAperture, formatShutter } from '../engine/settings';
import { cameraById, lensById, gearLabel } from '../data/catalogue';
import { challengeById } from '../data/challenges';
import { sanitizeText } from '../engine/sanitize';
import { downloadBlob } from '../utils/capture';
import { Wordmark } from '../components/Wordmark';

type Doc = 'photo' | 'contact-sheet' | 'worksheet' | 'certificate';

/** Which details a user can show or hide before printing. */
const INCLUDE_LABELS = [
  { key: 'name', labelKey: 'printPhotographerName' },
  { key: 'settings', labelKey: 'printSettings' },
  { key: 'gear', labelKey: 'camera' },
  { key: 'diagram', labelKey: 'printDiagram' },
  { key: 'histogram', labelKey: 'printHistogram' },
  { key: 'challenge', labelKey: 'challenges' },
  { key: 'score', labelKey: 'score' },
  { key: 'feedback', labelKey: 'printFeedback' },
  { key: 'reflection', labelKey: 'printReflection' },
  { key: 'date', labelKey: 'printDate' },
  { key: 'credit', labelKey: 'printCredit' },
] as const;

export default function PrintStudio() {
  const { t, pick } = useI18n();
  const { search } = useRouter();
  const { state, dispatch } = useStore();
  const [shots, setShots] = useState<StoredShot[]>([]);
  const [shotId, setShotId] = useState('');
  const [formatId, setFormatId] = useState('a4-portrait');
  const [doc, setDoc] = useState<Doc>('photo');
  const [urls, setUrls] = useState<UrlMap>({});
  const urlsRef = useRef<UrlMap>({});
  const [name, setName] = useState(state.prefs.photographerName);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [include, setInclude] = useState({
    name: true, settings: true, gear: true, diagram: true, histogram: false,
    challenge: true, score: true, feedback: false, reflection: true, date: true, credit: true,
  });

  // Shots and their object URLs are loaded together, so URLs are created
  // where the data arrives rather than in a render-phase effect.
  useEffect(() => {
    let cancelled = false;
    void listShots().then((all) => {
      if (cancelled) return;
      revokeUrls(urlsRef.current);
      const next = createUrls(all, (s) => s.blob);
      urlsRef.current = next;
      setShots(all);
      setUrls(next);
      const fromUrl = new URLSearchParams(search).get('shot');
      setShotId(fromUrl && all.some((s) => s.id === fromUrl) ? fromUrl : all[0]?.id ?? '');
    });
    return () => {
      cancelled = true;
      revokeUrls(urlsRef.current);
    };
  }, [search]);

  const shot = useMemo(() => shots.find((s) => s.id === shotId), [shots, shotId]);
  const format = PRINT_FORMATS.find((f) => f.id === formatId) ?? PRINT_FORMATS[0]!;

  const doPrint = () => {
    try {
      dispatch({ type: 'set-prefs', patch: { photographerName: sanitizeText(name, 60) } });
      window.print();
    } catch {
      setError(t('errorPrint'));
    }
  };

  const doExport = async (type: 'image/png' | 'image/jpeg') => {
    if (!shot) return;
    try {
      if (type === 'image/jpeg') {
        downloadBlob(shot.blob, 'tatu-print.jpg');
        return;
      }
      // Re-encode to PNG locally (no EXIF/GPS is ever present).
      const img = new Image();
      const url = URL.createObjectURL(shot.blob);
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('load')); img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => { if (b) downloadBlob(b, 'tatu-print.png'); else setError(t('errorExport')); }, 'image/png');
    } catch {
      setError(t('errorExport'));
    }
  };

  const toggle = (key: keyof typeof include) => setInclude({ ...include, [key]: !include[key] });

  return (
    <div>
      <h1 className="no-print">{t('printStudio')}</h1>
      {error && <p className="notice error no-print" role="alert">{error}</p>}

      <div className="no-print card" style={{ marginBottom: '1rem', display: 'grid', gap: '0.6rem' }}>
        <label>
          {t('printFormat')}{' '}
          <select value={formatId} onChange={(e) => setFormatId(e.target.value)} data-testid="print-format">
            {PRINT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label>
          Document{' '}
          <select value={doc} onChange={(e) => setDoc(e.target.value as Doc)} data-testid="print-doc">
            <option value="photo">{t('print')} — {t('gallery')}</option>
            <option value="contact-sheet">{t('printContactSheet')}</option>
            <option value="worksheet">{t('printWorksheet')}</option>
            <option value="certificate">{t('printCertificate')}</option>
          </select>
        </label>
        {doc === 'photo' && (
          <label>
            {t('gallery')}{' '}
            <select value={shotId} onChange={(e) => setShotId(e.target.value)} data-testid="print-shot">
              {shots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleDateString()} — {formatAperture(s.settings.aperture)} {formatShutter(s.settings.shutter)} ISO {s.settings.iso}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('printPhotographerName')}{' '}
          <input type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('printFeedback')}{' '}
          <input type="text" maxLength={200} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        <fieldset>
          <legend>{t('printOptions')}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {INCLUDE_LABELS.map(({ key, labelKey }) => (
              <label key={key} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                <input type="checkbox" checked={include[key]} onChange={() => toggle(key)} />
                {t(labelKey)}
              </label>
            ))}
          </div>
        </fieldset>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" data-testid="print-button" onClick={doPrint}>{t('saveAsPdf')}</button>
          <button type="button" className="btn" onClick={() => void doExport('image/png')} disabled={!shot}>{t('exportPng')}</button>
          <button type="button" className="btn" onClick={() => void doExport('image/jpeg')} disabled={!shot}>{t('exportJpeg')}</button>
        </div>
      </div>

      {doc === 'photo' && !shot && (
        <p className="no-print">{t('noPhotosToPrint')} <Link to="/simulator">{t('navSimulator')} →</Link></p>
      )}

      <div className={`print-sheet fmt-${format.id}`} data-testid="print-sheet">
        {doc === 'photo' && shot && (
          <PhotoSheet shot={shot} url={urls[shot.id] ?? ''} include={include} name={name} feedback={feedback} pick={pick} feedbackLabel={t('printFeedback')} />
        )}
        {doc === 'contact-sheet' && (
          <div>
            <h2>{t('printContactSheet')}</h2>
            <div className="print-contact-grid">
              {shots.slice(0, 12).map((s) => (
                <figure key={s.id}>
                  <img src={urls[s.id]} alt="" />
                  <figcaption>
                    {formatAperture(s.settings.aperture)} · {formatShutter(s.settings.shutter)} · ISO {s.settings.iso}
                  </figcaption>
                </figure>
              ))}
            </div>
            {include.credit && <p className="print-credit">Tatu Exposure Lab by Storitellah</p>}
          </div>
        )}
        {doc === 'worksheet' && <Worksheet name={sanitizeText(name, 60)} />}
        {doc === 'certificate' && (
          <div className="certificate">
            <Wordmark size={64} />
            <h2>Certificate of Achievement</h2>
            <p style={{ fontSize: '14pt' }}>{sanitizeText(name, 60) || '________________________'}</p>
            <p>has explored the exposure triangle — aperture, shutter speed and ISO —<br />in Tatu Exposure Lab.</p>
            <p>{new Date().toLocaleDateString()}</p>
            {include.credit && <p className="print-credit">Tatu Exposure Lab by Storitellah — Three controls. One creative decision.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoSheet({ shot, url, include, name, feedback, pick, feedbackLabel }: {
  shot: StoredShot;
  url: string;
  include: Record<string, boolean>;
  name: string;
  feedback: string;
  pick: (o: { en: string; sw: string }) => string;
  feedbackLabel: string;
}) {
  const cam = cameraById(shot.cameraId);
  const lens = lensById(shot.lensId);
  const challenge = shot.challengeId ? challengeById(shot.challengeId) : undefined;
  return (
    <div>
      <img src={url} alt="" />
      <div className="print-meta">
        {include.name && name && <span><strong>{sanitizeText(name, 60)}</strong></span>}
        {include.settings && (
          <span>
            {formatAperture(shot.settings.aperture)} · {formatShutter(shot.settings.shutter)} · ISO {shot.settings.iso} · {shot.settings.focalMm}mm
          </span>
        )}
        {include.gear && <span>{gearLabel(cam)} + {gearLabel(lens)}</span>}
        {include.challenge && challenge && <span>{pick(challenge.title)}</span>}
        {include.score && shot.score && <span>{shot.score.total}/100</span>}
        {include.date && <span>{new Date(shot.createdAt).toLocaleDateString()}</span>}
      </div>
      {include.diagram && (
        <svg width="120" height="100" viewBox="0 0 120 100" aria-hidden="true">
          <path d="M60 8 L112 88 L8 88 Z" fill="none" stroke="#333" strokeWidth="2" />
          <text x="60" y="6" textAnchor="middle" fontSize="9">Aperture {formatAperture(shot.settings.aperture)}</text>
          <text x="14" y="98" fontSize="9">Shutter {formatShutter(shot.settings.shutter)}</text>
          <text x="82" y="98" fontSize="9">ISO {shot.settings.iso}</text>
        </svg>
      )}
      {include.feedback && feedback && <p><strong>{feedbackLabel}:</strong> {sanitizeText(feedback, 200)}</p>}
      {include.reflection && shot.reflection && <p style={{ fontStyle: 'italic' }}>“{shot.reflection}”</p>}
      {include.credit && <p className="print-credit">Tatu Exposure Lab by Storitellah — Three controls. One creative decision.</p>}
    </div>
  );
}

function Worksheet({ name }: { name: string }) {
  return (
    <div className="worksheet">
      <h2>Exposure Triangle Worksheet</h2>
      <p>Name: <span className="write-line">{name}</span>  Date: <span className="write-line" /></p>
      <ol>
        <li>Exposure is controlled by three settings: <span className="write-line" />, <span className="write-line" /> and <span className="write-line" />.</li>
        <li>Opening the aperture from f/8 to f/4 adds <span className="write-line" /> stops of light.</li>
        <li>To freeze a sprinting footballer, a good shutter speed is about <span className="write-line" />.</li>
        <li>Doubling ISO makes the image one stop brighter, but adds more <span className="write-line" />.</li>
        <li>A wide aperture such as f/1.8 makes the depth of field <span className="write-line" />.</li>
        <li>At 24 fps, the 180° shutter angle rule suggests a shutter speed of <span className="write-line" />.</li>
        <li>Draw your own exposure triangle and label each corner:</li>
      </ol>
      <div style={{ height: '60mm', border: '1px dashed #999' }} />
      <p className="print-credit">Tatu Exposure Lab by Storitellah</p>
    </div>
  );
}
