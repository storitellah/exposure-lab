/**
 * Device capability helpers. Feature detection first; userAgentData is only
 * a secondary enhancement and user-agent strings are never parsed.
 */
import type { Quality } from '../scenes/renderer';

export function detectDefaultQuality(): Quality {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.screen.width, window.screen.height) < 480;
    const mobileHint = nav.userAgentData?.mobile === true; // secondary signal only
    if (cores <= 2 || memory <= 2 || small) return 'low';
    if (coarse || mobileHint || cores <= 4) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}

export function isTouchPrimary(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

export function supportsHover(): boolean {
  try { return window.matchMedia('(hover: hover)').matches; } catch { return true; }
}

/** navigator.vibrate wrapper (no-op where unsupported). */
export function haptic(ms = 18): void {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferredInstall;
}

export function onInstallAvailable(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function clearInstallPrompt(): void {
  deferredInstall = null;
}
