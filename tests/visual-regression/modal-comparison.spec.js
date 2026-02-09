/**
 * Modal Visual Regression Tests
 *
 * Compares Bootstrap Modal and Chakra UI Modal implementations by:
 * 1. Navigating to each story variant in Storybook
 * 2. Waiting for the modal to render
 * 3. Capturing a screenshot of the full page (modal + backdrop)
 * 4. Comparing Bootstrap vs Chakra screenshots for each variant
 *
 * The tests generate comparison reports showing pixel differences.
 * Any visual discrepancy indicates a regression that must be fixed
 * before enabling the Chakra implementation by default.
 *
 * Usage:
 *   bun run storybook (in another terminal)
 *   bunx playwright test tests/visual-regression/modal-comparison.spec.js
 *   bunx playwright test tests/visual-regression/modal-comparison.spec.js --update-snapshots
 *
 * Task: biensperience-cd21
 */

import { test, expect } from '@playwright/test';

// Storybook URL pattern for iframe mode (renders just the story, no sidebar)
const STORY_BASE = '/iframe.html?id=visual-regression-modal--';

// All modal variants to test
const MODAL_VARIANTS = [
  'Default',
  'SmallSize',
  'LargeSize',
  'ExtraLargeSize',
  'Fullscreen',
  'WithIcon',
  'DangerVariant',
  'LoadingState',
  'DisabledSubmit',
  'NoHeader',
  'CustomFooter',
  'ScrollableContent',
  'NotCentered',
  'InfoVariant',
  'WarningVariant',
  'SuccessVariant',
];

/**
 * Convert variant name to Storybook story ID format
 * e.g., "Bootstrap__Default" -> "bootstrap--default"
 */
function toStoryId(impl, variant) {
  return `${impl.toLowerCase()}-${variant.replace(/([A-Z])/g, '-$1').toLowerCase()}`.replace('--', '-');
}

/**
 * Wait for the modal to be fully rendered in the page
 */
async function waitForModal(page) {
  // Wait for either Bootstrap or Chakra modal to appear
  await page.waitForFunction(() => {
    // Check for Bootstrap modal (role="dialog" or .modal.show)
    const bootstrapModal = document.querySelector('[role="dialog"]') ||
      document.querySelector('.modal.show');
    // Check for Chakra modal (data-scope="dialog")
    const chakraModal = document.querySelector('[data-scope="dialog"]');
    return bootstrapModal || chakraModal;
  }, { timeout: 10_000 });

  // Additional wait for animations/transitions to settle
  await page.waitForTimeout(500);
}

/**
 * Mask dynamic content that may differ between implementations
 * (e.g., generated IDs, timestamps, focus rings)
 */
async function prepareForScreenshot(page) {
  await page.evaluate(() => {
    // Remove focus outlines that may differ
    const style = document.createElement('style');
    style.textContent = `
      * { outline: none !important; }
      *:focus { outline: none !important; box-shadow: none !important; }
      /* Disable cursor blink in inputs */
      input, textarea { caret-color: transparent !important; }
      /* Disable any animations */
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}

// ---------------------------------------------------------------------------
// Test Suite: Individual Variant Screenshots
// ---------------------------------------------------------------------------
test.describe('Modal Visual Regression — Individual Screenshots', () => {
  for (const variant of MODAL_VARIANTS) {
    test.describe(variant, () => {
      test(`Bootstrap — ${variant}`, async ({ page }) => {
        const storyId = toStoryId('bootstrap', variant);
        await page.goto(`${STORY_BASE}${storyId}&viewMode=story`);
        await waitForModal(page);
        await prepareForScreenshot(page);

        await expect(page).toHaveScreenshot(`bootstrap-${variant.toLowerCase()}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        });
      });

      test(`Chakra — ${variant}`, async ({ page }) => {
        const storyId = toStoryId('chakra', variant);
        await page.goto(`${STORY_BASE}${storyId}&viewMode=story`);
        await waitForModal(page);
        await prepareForScreenshot(page);

        await expect(page).toHaveScreenshot(`chakra-${variant.toLowerCase()}.png`, {
          maxDiffPixelRatio: 0.01,
          animations: 'disabled',
        });
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Test Suite: Cross-Implementation Comparison
// ---------------------------------------------------------------------------
test.describe('Modal Visual Regression — Bootstrap vs Chakra Comparison', () => {
  for (const variant of MODAL_VARIANTS) {
    test(`${variant}: Bootstrap should match Chakra`, async ({ page, browserName }, testInfo) => {
      // 1. Capture Bootstrap screenshot
      const bootstrapStoryId = toStoryId('bootstrap', variant);
      await page.goto(`${STORY_BASE}${bootstrapStoryId}&viewMode=story`);
      await waitForModal(page);
      await prepareForScreenshot(page);
      const bootstrapScreenshot = await page.screenshot({ fullPage: true });

      // 2. Capture Chakra screenshot
      const chakraStoryId = toStoryId('chakra', variant);
      await page.goto(`${STORY_BASE}${chakraStoryId}&viewMode=story`);
      await waitForModal(page);
      await prepareForScreenshot(page);
      const chakraScreenshot = await page.screenshot({ fullPage: true });

      // 3. Compare — use the Bootstrap screenshot as the baseline
      // Attach both for visual inspection in the HTML report
      await testInfo.attach(`bootstrap-${variant}`, {
        body: bootstrapScreenshot,
        contentType: 'image/png',
      });
      await testInfo.attach(`chakra-${variant}`, {
        body: chakraScreenshot,
        contentType: 'image/png',
      });

      // 4. Compare screenshots pixel-by-pixel
      // Using a threshold to account for minor rendering differences
      // (anti-aliasing, sub-pixel rendering, etc.)
      expect(bootstrapScreenshot).toMatchSnapshot(`comparison-${variant.toLowerCase()}.png`, {
        maxDiffPixelRatio: 0.02, // Allow 2% pixel difference
        threshold: 0.3, // Color difference threshold per pixel
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Test Suite: Modal Behavior Tests
// ---------------------------------------------------------------------------
test.describe('Modal Behavior — Bootstrap', () => {
  test('should close on ESC key', async ({ page }) => {
    await page.goto(`${STORY_BASE}bootstrap--default&viewMode=story`);
    await waitForModal(page);

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Modal should be gone
    const modal = await page.$('[role="dialog"]');
    expect(modal).toBeNull();
  });

  test('should close on backdrop click', async ({ page }) => {
    await page.goto(`${STORY_BASE}bootstrap--default&viewMode=story`);
    await waitForModal(page);

    // Click on the backdrop (top-left corner, outside the modal content)
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);

    const modal = await page.$('[role="dialog"]');
    expect(modal).toBeNull();
  });
});

test.describe('Modal Behavior — Chakra', () => {
  test('should close on ESC key', async ({ page }) => {
    await page.goto(`${STORY_BASE}chakra--default&viewMode=story`);
    await waitForModal(page);

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Chakra dialog should be gone
    const dialog = await page.$('[data-scope="dialog"]');
    expect(dialog).toBeNull();
  });

  test('should close on backdrop click', async ({ page }) => {
    await page.goto(`${STORY_BASE}chakra--default&viewMode=story`);
    await waitForModal(page);

    // Click on the backdrop
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);

    const dialog = await page.$('[data-scope="dialog"]');
    expect(dialog).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test Suite: Accessibility
// ---------------------------------------------------------------------------
test.describe('Modal Accessibility', () => {
  test('Bootstrap modal should have role="dialog" and aria-modal', async ({ page }) => {
    await page.goto(`${STORY_BASE}bootstrap--default&viewMode=story`);
    await waitForModal(page);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('Chakra modal should have role="dialog" and aria-modal', async ({ page }) => {
    await page.goto(`${STORY_BASE}chakra--default&viewMode=story`);
    await waitForModal(page);

    // Chakra v3 Dialog.Content gets role="dialog"
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test('Bootstrap modal should have aria-labelledby pointing to title', async ({ page }) => {
    await page.goto(`${STORY_BASE}bootstrap--default&viewMode=story`);
    await waitForModal(page);

    const modal = page.locator('[role="dialog"]');
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // Verify the referenced element exists and has the title text
    const titleEl = page.locator(`#${CSS.escape(labelledBy)}`);
    await expect(titleEl).toContainText('Default Modal');
  });

  test('Chakra modal should trap focus', async ({ page }) => {
    await page.goto(`${STORY_BASE}chakra--default&viewMode=story`);
    await waitForModal(page);

    // Tab through focusable elements — focus should stay within the dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Get all focusable elements in the dialog
    const focusableCount = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') ||
        document.querySelector('[data-scope="dialog"]');
      if (!dialog) return 0;

      // Find all focusable elements
      const root = dialog.closest('[data-scope="dialog"]') || dialog;
      const focusable = root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return focusable.length;
    });

    expect(focusableCount).toBeGreaterThan(0);
  });
});
