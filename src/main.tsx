import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/global.css';
import './styles/print.css';
import { App } from './App';
import { I18nProvider } from './i18n';
import { StoreProvider } from './state/store';
import { RouterProvider } from './router';
import { registerServiceWorker } from './sw-registration';
import { watchInstallPrompt } from './utils/device';

watchInstallPrompt();
registerServiceWorker();

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <I18nProvider>
          <StoreProvider>
            <RouterProvider>
              <App />
            </RouterProvider>
          </StoreProvider>
        </I18nProvider>
      </StrictMode>,
    );
  } catch (err) {
    // A failure while mounting the providers happens outside any error
    // boundary, which would otherwise leave a blank page. Report it as text
    // (never as HTML) so the user has something to act on.
    rootEl.textContent = '';
    const box = document.createElement('div');
    box.className = 'boot-fallback';
    const heading = document.createElement('h1');
    heading.textContent = 'Tatu Exposure Lab could not start';
    const detail = document.createElement('p');
    detail.textContent =
      'Something went wrong while loading the app. Please reload the page. If it keeps happening, clearing this site\'s data usually fixes it.';
    const reason = document.createElement('p');
    reason.className = 'boot-hint';
    reason.textContent = err instanceof Error ? err.message : String(err);
    box.append(heading, detail, reason);
    rootEl.appendChild(box);
  }
}
