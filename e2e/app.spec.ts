import { test, expect, type Page } from '@playwright/test';

/**
 * Open the app with first-launch onboarding already completed, so tests
 * start from the normal UI. Onboarding itself is covered separately.
 */
async function openApp(page: Page, path = '/') {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tatu-prefs', JSON.stringify({ onboardingDone: true }));
    } catch {
      /* storage blocked — the onboarding dialog is dismissible anyway */
    }
  });
  await page.goto(path);
}

test.describe('core flows', () => {
  test('shows first-launch onboarding and lets the user skip it', async ({ page }) => {
    await page.goto('/');
    const onboarding = page.getByTestId('onboarding');
    await expect(onboarding).toBeVisible();
    await expect(onboarding).toContainText('Tatu');
    await page.getByTestId('skip-onboarding').click();
    await expect(onboarding).toBeHidden();
  });

  test('loads home with brand and mode cards', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tatu Exposure Lab');
    await expect(page.getByTestId('online-status')).toBeVisible();
  });

  test('takes and saves a simulated photograph, then deletes it', async ({ page }) => {
    await openApp(page, '/simulator');
    await page.getByTestId('shutter-button').click();
    await expect(page.getByTestId('shot-review')).toBeVisible();
    await expect(page.getByTestId('review-image')).toBeVisible();
    await page.getByTestId('keep-button').click();
    await expect(page.getByTestId('saved-note')).toBeVisible();
    await page.getByTestId('close-review').click();

    await page.goto('/gallery');
    await expect(page.getByTestId('gallery-grid').locator('img').first()).toBeVisible();
    await page.getByTestId('gallery-grid').locator('img').first().click();
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('delete-shot').click();
    await expect(page.getByTestId('gallery-empty')).toBeVisible();
  });

  test('changing settings updates the readout and feedback', async ({ page }) => {
    await openApp(page, '/simulator');
    const isoPlus = page.getByRole('button', { name: 'ISO +' });
    await isoPlus.click();
    await expect(page.getByTestId('change-feedback')).toContainText('ISO');
  });

  test('changes camera body and lens; incompatible lenses are disabled', async ({ page }) => {
    await openApp(page, '/simulator');
    await page.getByTestId('toggle-gear').click();
    await page.getByTestId('camera-select').selectOption('canon-r6ii');
    const lensSelect = page.getByTestId('lens-select');
    // A Nikon Z lens must be un-selectable on a Canon RF body.
    const zLens = lensSelect.locator('option[value="nikkor-z85"]');
    await expect(zLens).toBeDisabled();
    // An EF lens works through an adapter, with an explanation.
    await lensSelect.selectOption('canon-tse24');
    await expect(page.getByTestId('adapter-note')).toBeVisible();
    // A native RF lens selects cleanly.
    await lensSelect.selectOption('canon-rf50-18');
    await expect(page.getByTestId('adapter-note')).toHaveCount(0);
  });

  test('completes the first lesson', async ({ page }) => {
    await openApp(page, '/learn/what-is-exposure');
    // The lesson starts deliberately overexposed — there must be something
    // to solve before the meter can be balanced.
    await expect(page.locator('.meter-status').first()).toContainText('Overexposed');
    // Nudge shutter until the meter balances, then check.
    for (let i = 0; i < 30; i++) {
      const status = await page.locator('.meter-status').first().textContent();
      if (status?.includes('Balanced')) break;
      const darker = status?.includes('Overexposed');
      await page.getByRole('button', { name: darker ? 'Shutter speed −' : 'Shutter speed +' }).click();
    }
    await page.getByTestId('lesson-check').click();
    await expect(page.getByTestId('lesson-success')).toBeVisible();
  });

  test('opens a deterministic challenge link and rejects a bad one', async ({ page }) => {
    await openApp(page, '/challenges?c=freeze-footballer&sc=football');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Freeze the footballer');
    await page.goto('/challenges?c=<script>&sc=nope');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('scores a challenge shot', async ({ page }) => {
    await openApp(page, '/challenges');
    await page.getByTestId('start-freeze-footballer').click();
    await page.getByTestId('shutter-button').click();
    await expect(page.getByTestId('score-breakdown')).toContainText('/100');
  });

  test('downloads a photograph', async ({ page }) => {
    await openApp(page, '/simulator');
    await page.getByTestId('shutter-button').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.jpg');
  });

  test('print studio renders a printable sheet', async ({ page }) => {
    await openApp(page, '/simulator');
    await page.getByTestId('shutter-button').click();
    await page.getByTestId('keep-button').click();
    await page.getByTestId('close-review').click();
    await page.goto('/print');
    await expect(page.getByTestId('print-sheet')).toBeVisible();
    await page.getByTestId('print-doc').selectOption('worksheet');
    await expect(page.getByTestId('print-sheet')).toContainText('Exposure Triangle Worksheet');
  });

  test('keyboard controls adjust settings and take a photo', async ({ page }) => {
    await openApp(page, '/simulator');
    const before = await page.getByTestId('readout-aperture').textContent();
    // Retry once in case the first keypress lands before hydration.
    await expect(async () => {
      await page.keyboard.press('a');
      const after = await page.getByTestId('readout-aperture').textContent();
      expect(after).not.toBe(before);
    }).toPass({ timeout: 5000 });
    await page.keyboard.press(' ');
    await expect(page.getByTestId('shot-review')).toBeVisible();
  });

  test('denying camera permission shows a friendly message and app keeps working', async ({ page, context }) => {
    await context.grantPermissions([]); // no camera permission
    await openApp(page, '/my-camera');
    await page.getByTestId('enable-camera').click();
    await expect(page.getByRole('alert')).toBeVisible();
    // The rest of the app still works.
    await page.goto('/simulator');
    await expect(page.getByTestId('shutter-button')).toBeVisible();
  });

  test('language switches without reload', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('language-select').selectOption('sw');
    await page.getByRole('button', { name: 'Funga' }).click();
    await expect(page.locator('nav.main-nav')).toContainText(/Nyumbani|Jifunze|Kiigizi/);
  });

  test('clear all local data empties the gallery', async ({ page }) => {
    await openApp(page, '/simulator');
    await page.getByTestId('shutter-button').click();
    await page.getByTestId('keep-button').click();
    await page.getByTestId('close-review').click();
    await page.goto('/gallery');
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('clear-all').click();
    await expect(page.getByTestId('gallery-empty')).toBeVisible();
  });
});

/**
 * Required device sizes from the product spec. The simulator must be usable
 * at every one of them with no horizontal scrolling.
 */
const VIEWPORTS = [
  { width: 320, height: 568 }, { width: 375, height: 667 },
  { width: 390, height: 844 }, { width: 430, height: 932 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
  { width: 1366, height: 768 }, { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test.describe('responsive layout', () => {
  for (const size of VIEWPORTS) {
    test(`no horizontal scrolling at ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openApp(page, '/simulator');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
      // The shutter button must be reachable and large enough to tap.
      const box = await page.getByTestId('shutter-button').boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    });
  }

  test('landscape orientation keeps the preview and controls usable', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openApp(page, '/simulator');
    await expect(page.getByTestId('shutter-button')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('video mode', () => {
  test('shutter angle follows the 180° rule when frame rate changes', async ({ page }) => {
    await openApp(page, '/video');
    await page.locator('#fps-select').selectOption('60');
    await expect(page.getByTestId('readout-shutter')).toContainText('1/120');
  });
});
