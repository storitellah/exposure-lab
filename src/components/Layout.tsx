/**
 * App shell: header with navigation, footer with legal links and
 * online/offline status, settings dialog, install prompt and SW updates.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useRouter } from '../router';
import { useI18n, type Language } from '../i18n';
import { useStore } from '../state/store';
import { APP_VERSION } from '../version';
import { getInstallPrompt, onInstallAvailable, clearInstallPrompt } from '../utils/device';
import { onServiceWorkerUpdate } from '../sw-registration';
import { Wordmark } from './Wordmark';
import { StoritellahLink } from './StoritellahLink';

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { state, dispatch } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [installable, setInstallable] = useState(!!getInstallPrompt());
  const settingsRef = useRef<HTMLDialogElement>(null);
  const { navigate } = useRouter();

  // Documented optional shortcuts: G gallery, P print, H help/glossary.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g') navigate('/gallery');
      if (e.key === 'p') navigate('/print');
      if (e.key === 'h') navigate('/glossary');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const unsubInstall = onInstallAvailable(() => setInstallable(true));
    const unsubSw = onServiceWorkerUpdate(() => setUpdateReady(true));
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      unsubInstall();
      unsubSw();
    };
  }, []);

  const install = async () => {
    const prompt = getInstallPrompt();
    if (prompt) {
      await prompt.prompt();
      clearInstallPrompt();
      setInstallable(false);
    }
  };

  const navItems: { to: string; label: string }[] = [
    { to: '/', label: t('navHome') },
    { to: '/learn', label: t('navLearn') },
    { to: '/simulator', label: t('navSimulator') },
    { to: '/video', label: t('navVideo') },
    { to: '/challenges', label: t('navChallenges') },
    { to: '/gallery', label: t('navGallery') },
    { to: '/print', label: t('navPrint') },
    { to: '/teacher', label: t('navTeacher') },
  ];

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">{t('skipToContent')}</a>
      <header className="app-header">
        <div className="brand">
          {/* The logo repeats the home link for pointer users; keyboard and
              screen-reader users get one home link (the name) instead of two. */}
          <Link to="/" className="brand-logo" tabIndex={-1} ariaHidden>
            <Wordmark size={36} />
          </Link>
          <div className="brand-text">
            <Link to="/" className="brand-name">{t('appName')}</Link>
            <StoritellahLink className="brand-by">{t('byStoritellah')}</StoritellahLink>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn nav-toggle"
          aria-expanded={navOpen}
          aria-label={t('navMore')}
          onClick={() => setNavOpen(!navOpen)}
          data-testid="nav-toggle"
        >
          ☰
        </button>
        <nav className={`main-nav ${navOpen ? 'open' : ''}`} aria-label="Main">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} onNavigate={() => setNavOpen(false)}>{item.label}</Link>
          ))}
        </nav>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('settings')}
          data-testid="open-settings"
          onClick={() => settingsRef.current?.showModal()}
        >
          ⚙
        </button>
      </header>

      {updateReady && (
        <div className="notice" role="status" style={{ margin: '0.5rem 1rem' }}>
          {t('updateAvailable')}{' '}
          <button type="button" className="btn" onClick={() => window.location.reload()}>{t('reload')}</button>
        </div>
      )}

      <main id="main" className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Wordmark size={44} />
            <div>
              <p className="footer-name">{t('appName')}</p>
              <p className="footer-by">{t('byPrefix')} <StoritellahLink /></p>
              <p className="footer-tagline">{t('tagline')}</p>
            </div>
          </div>
          <nav className="footer-nav" aria-label="Footer">
            <div>
              <h2>{t('footerExplore')}</h2>
              <ul>
                <li><Link to="/learn">{t('navLearn')}</Link></li>
                <li><Link to="/simulator">{t('navSimulator')}</Link></li>
                <li><Link to="/depth-of-field">{t('navDof')}</Link></li>
                <li><Link to="/glossary">{t('navGlossary')}</Link></li>
              </ul>
            </div>
            <div>
              <h2>{t('footerInfo')}</h2>
              <ul>
                <li><Link to="/about">{t('navAbout')}</Link></li>
                <li><Link to="/privacy">{t('navPrivacy')}</Link></li>
                <li><Link to="/accessibility">{t('navAccessibility')}</Link></li>
                <li><Link to="/security">{t('navSecurity')}</Link></li>
                <li><Link to="/support">{t('navSupport')}</Link></li>
              </ul>
            </div>
          </nav>
          <div className="footer-meta">
            <p>© {new Date().getFullYear()} <StoritellahLink /></p>
            <p>{t('version')} {APP_VERSION}</p>
            <p>
              <span className={`status-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" />
              <span data-testid="online-status">{online ? t('online') : t('offline')}</span>
            </p>
          </div>
        </div>
        <p className="footer-note">{t('independentShort')}</p>
      </footer>

      <dialog ref={settingsRef} aria-label={t('settings')}>
        <h2>{t('settings')}</h2>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <label>
            {t('language')}{' '}
            <select value={lang} onChange={(e) => setLang(e.target.value as Language)} data-testid="language-select">
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </label>
          <label>
            {t('theme')}{' '}
            <select
              value={state.prefs.theme}
              onChange={(e) => dispatch({ type: 'set-prefs', patch: { theme: e.target.value as 'dark' | 'light' | 'system' } })}
            >
              <option value="system">{t('themeSystem')}</option>
              <option value="dark">{t('themeDark')}</option>
              <option value="light">{t('themeLight')}</option>
            </select>
          </label>
          <label>
            {t('renderQuality')}{' '}
            <select
              value={state.prefs.quality}
              onChange={(e) => dispatch({ type: 'set-prefs', patch: { quality: e.target.value as 'auto' | 'low' | 'medium' | 'high' } })}
            >
              <option value="auto">Auto</option>
              <option value="low">{t('qualityLow')}</option>
              <option value="medium">{t('qualityMedium')}</option>
              <option value="high">{t('qualityHigh')}</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={state.prefs.sound} onChange={(e) => dispatch({ type: 'set-prefs', patch: { sound: e.target.checked } })} />
            {t('sound')}
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={state.prefs.animations} onChange={(e) => dispatch({ type: 'set-prefs', patch: { animations: e.target.checked } })} />
            {t('animations')}
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={state.prefs.gamification} onChange={(e) => dispatch({ type: 'set-prefs', patch: { gamification: e.target.checked } })} />
            {t('gamification')}
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={state.prefs.highContrast} onChange={(e) => dispatch({ type: 'set-prefs', patch: { highContrast: e.target.checked } })} />
            {t('highContrast')}
          </label>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={state.prefs.largeControls} onChange={(e) => dispatch({ type: 'set-prefs', patch: { largeControls: e.target.checked } })} />
            {t('largeControls')}
          </label>
          {installable && (
            <button type="button" className="btn primary" onClick={() => void install()}>{t('installApp')}</button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.();
            }}
          >
            {t('fullscreen')}
          </button>
        </div>
        <form method="dialog" style={{ marginTop: '1rem' }}>
          <button className="btn primary">{t('close')}</button>
        </form>
      </dialog>
    </div>
  );
}
