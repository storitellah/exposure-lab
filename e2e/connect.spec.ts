import { test, expect } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

/**
 * "Connect a camera" with Chromium's built-in fake video device standing in
 * for a USB-C webcam-mode camera or an HDMI capture card.
 */
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
  permissions: ['camera'],
});

test('shows a live preview from a connected video device and disconnects cleanly', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'fake media devices are a Chromium feature');
  await page.addInitScript(() => localStorage.setItem('tatu-prefs', JSON.stringify({ onboardingDone: true })));
  await page.goto('/my-camera');
  await page.getByTestId('enable-camera').click();
  const preview = page.getByTestId('live-preview');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  // Either live controls or an honest "this device offers none" message.
  await expect(page.getByTestId('live-controls').or(page.getByTestId('no-live-controls'))).toBeVisible();
  await page.getByTestId('simulate-toggle').check();
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.style.filter)).toContain('brightness');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(preview).toBeHidden();
});
