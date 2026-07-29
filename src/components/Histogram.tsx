/** Luminance histogram with colour-blind-safe clipping indicators. */
import { useEffect, useRef } from 'react';
import type { HistogramData } from '../scenes/renderer';
import { useI18n } from '../i18n';

export function Histogram({ data }: { data: HistogramData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = 256);
    const h = (canvas.height = 74);
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...data.bins);
    const barW = w / data.bins.length;
    data.bins.forEach((v, i) => {
      const bh = (v / max) * (h - 6);
      ctx.fillStyle = i < 4 ? '#7FA6E8' : i > 59 ? '#E8A47F' : '#CFC9BC';
      ctx.fillRect(i * barW, h - bh, barW - 0.5, bh);
    });
  }, [data]);

  const clipHigh = data.clippedHighlights > 0.04;
  const clipLow = data.crushedShadows > 0.12;
  return (
    <div>
      <canvas
        ref={ref}
        className="histogram"
        role="img"
        aria-label={`${t('histogram')}. ${clipHigh ? t('clippingHighlights') : ''} ${clipLow ? t('clippingShadows') : ''}`}
      />
      {(clipHigh || clipLow) && (
        <p className="meter-status" role="status">
          {clipHigh && <span style={{ color: 'var(--warning-text)' }}>▲ {t('clippingHighlights')} </span>}
          {clipLow && <span style={{ color: 'var(--accent-text)' }}>▼ {t('clippingShadows')}</span>}
        </p>
      )}
    </div>
  );
}
