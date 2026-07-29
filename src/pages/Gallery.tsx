/** Private local gallery backed by IndexedDB. Works offline. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listShots, deleteShot, updateShot, clearAllLocalData, type StoredShot } from '../state/db';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { formatAperture, formatShutter } from '../engine/settings';
import { downloadBlob } from '../utils/capture';
import { createUrls, revokeUrls, revokeUrl, type UrlMap } from '../utils/objectUrls';
import { Link, useRouter } from '../router';
import { cameraById, lensById, gearLabel } from '../data/catalogue';
import { CHALLENGES } from '../data/challenges';

/** A shot opened in the detail view, with its full-size object URL. */
interface OpenShot {
  shot: StoredShot;
  url: string;
}

export default function Gallery() {
  const { t, pick } = useI18n();
  const { dispatch } = useStore();
  const { navigate } = useRouter();
  const [library, setLibrary] = useState<{ shots: StoredShot[]; urls: UrlMap }>({ shots: [], urls: {} });
  const [filter, setFilter] = useState<'all' | 'favourites' | string>('all');
  const [selected, setSelected] = useState<OpenShot | null>(null);
  const [compareWith, setCompareWith] = useState<OpenShot | null>(null);
  const [error, setError] = useState('');
  const urlsRef = useRef<UrlMap>({});

  // Loading happens in the effect; handlers request a reload by bumping the
  // token. Thumbnail URLs are minted where the data arrives, and the previous
  // batch is revoked at the same time.
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void listShots()
      .catch(() => {
        setError(t('errorCorrupt'));
        return [] as StoredShot[];
      })
      .then((shots) => {
        if (cancelled) return;
        revokeUrls(urlsRef.current);
        const urls = createUrls(shots, (s) => s.thumb);
        urlsRef.current = urls;
        setLibrary({ shots, urls });
      });
    return () => { cancelled = true; };
  }, [t, reloadToken]);

  useEffect(() => () => revokeUrls(urlsRef.current), []);

  const filtered = useMemo(() => {
    const { shots } = library;
    if (filter === 'all') return shots;
    if (filter === 'favourites') return shots.filter((s) => s.favourite);
    return shots.filter((s) => s.challengeId === filter);
  }, [library, filter]);

  const closeDetail = useCallback(() => {
    setSelected((prev) => { revokeUrl(prev?.url); return null; });
    setCompareWith((prev) => { revokeUrl(prev?.url); return null; });
  }, []);

  const openDetail = (shot: StoredShot) => {
    closeDetail();
    setSelected({ shot, url: URL.createObjectURL(shot.blob) });
  };

  const toggleCompare = () => {
    if (compareWith) {
      revokeUrl(compareWith.url);
      setCompareWith(null);
      return;
    }
    const other = library.shots.find(
      (s) => s.id !== selected?.shot.id && s.sceneId === selected?.shot.sceneId,
    );
    if (other) setCompareWith({ shot: other, url: URL.createObjectURL(other.blob) });
  };

  const toggleFav = async (shot: StoredShot) => {
    await updateShot({ ...shot, favourite: !shot.favourite });
    setSelected((prev) => (prev ? { ...prev, shot: { ...prev.shot, favourite: !shot.favourite } } : prev));
    refresh();
  };

  const remove = async (shot: StoredShot) => {
    await deleteShot(shot.id);
    closeDetail();
    refresh();
  };

  const clearAll = async () => {
    if (!window.confirm(t('clearConfirm'))) return;
    await clearAllLocalData();
    dispatch({ type: 'reset-progress' });
    closeDetail();
    refresh();
  };

  return (
    <div>
      <h1>{t('gallery')}</h1>
      <p className="notice">{t('galleryPrivate')}</p>
      {error && <p className="notice error" role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <label htmlFor="gallery-filter">{t('filterAll')}</label>
        <select id="gallery-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t('filterAll')}</option>
          <option value="favourites">{t('favourites')}</option>
          {CHALLENGES.map((c) => <option key={c.id} value={c.id}>{pick(c.title)}</option>)}
        </select>
        <button type="button" className="btn danger" data-testid="clear-all" onClick={() => void clearAll()}>
          {t('clearAllData')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p data-testid="gallery-empty">{t('galleryEmpty')} <Link to="/simulator">{t('navSimulator')} →</Link></p>
      ) : (
        <div className="gallery-grid" data-testid="gallery-grid">
          {filtered.map((shot) => (
            <figure key={shot.id} className="shot-card" style={{ margin: 0 }}>
              <img
                src={library.urls[shot.id]}
                alt={`${formatAperture(shot.settings.aperture)} ${formatShutter(shot.settings.shutter)} ISO ${shot.settings.iso}`}
                onClick={() => openDetail(shot)}
              />
              <figcaption>
                {formatAperture(shot.settings.aperture)} · {formatShutter(shot.settings.shutter)} · ISO {shot.settings.iso}
                {shot.score ? ` · ${shot.score.total}/100` : ''}
                {shot.favourite ? ' ★' : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {selected && (
        <ShotDetail
          open={selected}
          compareWith={compareWith}
          onCompare={toggleCompare}
          onFav={() => void toggleFav(selected.shot)}
          onDelete={() => void remove(selected.shot)}
          onClose={closeDetail}
          onPrint={() => navigate(`/print?shot=${selected.shot.id}`)}
        />
      )}
    </div>
  );
}

function ShotDetail({ open, compareWith, onCompare, onFav, onDelete, onClose, onPrint }: {
  open: OpenShot;
  compareWith: OpenShot | null;
  onCompare: () => void;
  onFav: () => void;
  onDelete: () => void;
  onClose: () => void;
  onPrint: () => void;
}) {
  const { t } = useI18n();
  const { shot, url } = open;
  const cam = cameraById(shot.cameraId);
  const lens = lensById(shot.lensId);

  return (
    <div className="card" style={{ marginTop: '1rem' }} data-testid="shot-detail">
      <h2>{t('shotReview')}</h2>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <img src={url} alt={t('shotReview')} style={{ maxWidth: compareWith ? '48%' : '100%', borderRadius: '8px' }} />
        {compareWith && (
          <img src={compareWith.url} alt={`${t('compare')} — ${t('attempt')} 2`} style={{ maxWidth: '48%', borderRadius: '8px' }} />
        )}
      </div>
      <p style={{ fontSize: '0.9rem' }}>
        {gearLabel(cam)} + {gearLabel(lens)} · {formatAperture(shot.settings.aperture)} ·{' '}
        {formatShutter(shot.settings.shutter)} · ISO {shot.settings.iso} · {shot.settings.focalMm}mm ·{' '}
        {t('date')}: {new Date(shot.createdAt).toLocaleString()}
        {shot.score ? ` · ${t('score')}: ${shot.score.total}/100` : ''}
      </p>
      {shot.reflection && <p style={{ fontStyle: 'italic' }}>“{shot.reflection}”</p>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onFav}>
          {shot.favourite ? `★ ${t('unfavourite')}` : `☆ ${t('favourite')}`}
        </button>
        <button type="button" className="btn" onClick={onCompare}>{t('compare')}</button>
        <button type="button" className="btn" onClick={() => downloadBlob(shot.blob, `tatu-${shot.id}.jpg`)}>
          {t('download')}
        </button>
        <button type="button" className="btn" onClick={onPrint}>{t('print')}</button>
        <button type="button" className="btn danger" data-testid="delete-shot" onClick={onDelete}>{t('deletePhoto')}</button>
        <button type="button" className="btn" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}
