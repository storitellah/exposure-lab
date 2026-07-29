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
}
