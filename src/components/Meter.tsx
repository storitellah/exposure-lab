/** Light meter: shows how far the exposure is from the metered target. */
import { useI18n } from '../i18n';

export function Meter({ reading }: { reading: number }) {
  const { t } = useI18n();
  const clamped = Math.max(-3, Math.min(3, reading));
  const pct = ((clamped + 3) / 6) * 100;
  const status = Math.abs(reading) <= 0.34 ? 'ok' : reading > 0 ? 'over' : 'under';
  const label =
    status === 'ok' ? t('balanced') : status === 'over' ? t('overexposed') : t('underexposed');
  return (
    <div>
      <div
        className="meter-scale"
        role="meter"
        aria-valuemin={-3}
        aria-valuemax={3}
        aria-valuenow={Math.round(reading * 10) / 10}
        aria-label={`${t('meter')}: ${label}, ${reading >= 0 ? '+' : ''}${reading.toFixed(1)} ${t('stops')}`}
      >
        <span aria-hidden="true">−3</span>
        <span aria-hidden="true">−2</span>
        <span aria-hidden="true">−1</span>
        <span aria-hidden="true">0</span>
        <span aria-hidden="true">+1</span>
        <span aria-hidden="true">+2</span>
        <span aria-hidden="true">+3</span>
        <span className="meter-needle" style={{ left: `calc(${pct}% - 2px)` }} aria-hidden="true" />
      </div>
      <p className={`meter-status ${status}`}>
        {label} · {reading >= 0 ? '+' : ''}{reading.toFixed(1)} {t('stops')}
      </p>
    </div>
  );
}
