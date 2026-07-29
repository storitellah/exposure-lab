/**
 * Service worker registration with update notification. The app never traps
 * the user on an old version: when a new worker is waiting we show a
 * reload button (see Layout).
 */
const updateListeners = new Set<() => void>();

export function onServiceWorkerUpdate(cb: () => void): () => void {
  updateListeners.add(cb);
  return () => updateListeners.delete(cb);
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // only register the built worker
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              updateListeners.forEach((l) => l());
            }
          });
        });
      })
      .catch(() => {
        /* Offline support is an enhancement; the app works without it. */
      });
  });
}
