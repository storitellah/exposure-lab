/**
 * Subtle animation of light entering the camera: the aperture opening
 * grows/shrinks, the shutter bar shows exposure duration, and the ISO dots
 * show amplification with noise. Pauses under reduced motion.
 */
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';

export function TriangleAnimation() {
  const { t } = useI18n();
  const { state } = useStore();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!state.prefs.animations) return;
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 60), 100);
    return () => window.clearInterval(id);
  }, [state.prefs.animations]);

  const apertureR = 10 + 7 * Math.sin((phase / 60) * Math.PI * 2);
  const shutterW = 40 + 32 * Math.sin((phase / 60) * Math.PI * 2 + 1);
  const isoGlow = 0.35 + 0.3 * Math.sin((phase / 60) * Math.PI * 2 + 2);

  return (
    <div className="triangle-anim" aria-hidden="true">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <title>{t('aperture')}</title>
        <circle cx="45" cy="45" r="30" fill="none" stroke="var(--line)" strokeWidth="3" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line
            key={i}
            x1={45 + apertureR * Math.cos((i / 6) * Math.PI * 2)}
            y1={45 + apertureR * Math.sin((i / 6) * Math.PI * 2)}
            x2={45 + 29 * Math.cos(((i + 0.5) / 6) * Math.PI * 2)}
            y2={45 + 29 * Math.sin(((i + 0.5) / 6) * Math.PI * 2)}
            stroke="#FBB03B"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
        <circle className="aperture-blades" cx="45" cy="45" r={apertureR} fill="#F3F1EC" opacity="0.9" />
        <text x="45" y="86" textAnchor="middle" fontSize="9" fill="currentColor">{t('aperture')}</text>
      </svg>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <title>{t('shutterSpeed')}</title>
        <rect x="10" y="30" width="70" height="28" rx="6" fill="none" stroke="var(--line)" strokeWidth="3" />
        <rect x="12" y="33" width={shutterW} height="22" rx="4" fill="#3C82F6" />
        <text x="45" y="86" textAnchor="middle" fontSize="9" fill="currentColor">{t('shutterSpeed')}</text>
      </svg>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <title>ISO</title>
        <circle cx="45" cy="44" r="26" fill="#2E9B62" opacity={isoGlow} />
        {[...Array(14)].map((_, i) => (
          <circle
            key={i}
            cx={24 + ((i * 37) % 44)}
            cy={24 + ((i * 23) % 40)}
            r="1.6"
            fill="currentColor"
            opacity={isoGlow > 0.5 ? 0.75 : 0.15}
          />
        ))}
        <text x="45" y="86" textAnchor="middle" fontSize="9" fill="currentColor">ISO</text>
      </svg>
    </div>
  );
}
