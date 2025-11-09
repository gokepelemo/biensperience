/**
 * Visual Regression Test Suite
 * Uses Puppeteer to capture screenshots and compare against baselines
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');

// Configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BASELINE_DIR = path.join(__dirname, 'screenshots', 'baseline');
const CURRENT_DIR = path.join(__dirname, 'screenshots', 'current');
const DIFF_DIR = path.join(__dirname, 'screenshots', 'diff');
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === 'true';
const JWT_TOKEN = process.env.JWT_TOKEN;

// Views to test
const VIEWS = [
  { name: 'home', path: '/', requiresAuth: false },
  { name: 'app-home', path: '/app', requiresAuth: true },
  { name: 'destinations', path: '/destinations', requiresAuth: true },
  { name: 'experiences', path: '/experiences', requiresAuth: true },
  { name: 'profile', path: '/profile', requiresAuth: true },
  { name: 'single-destination', path: '/destinations/:id', requiresAuth: true, needsData: true },
  { name: 'single-experience', path: '/experiences/:id', requiresAuth: true, needsData: true },
];

// Viewports to test
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Ensure all screenshot directories exist
 */
function ensureDirectories() {
  [BASELINE_DIR, CURRENT_DIR, DIFF_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Set authentication cookie for authenticated routes
 */
async function setAuthCookie(page) {
  if (!JWT_TOKEN) {
    console.warn(`${colors.yellow}Warning: No JWT_TOKEN provided, authenticated routes may fail${colors.reset}`);
    return;
  }

  await page.setCookie({
    name: 'auth_token',
    value: JWT_TOKEN,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
  });
}

/**
 * Compare two images and return comparison result
 */
async function compareImages(baselinePath, currentPath, diffPath) {
  // No baseline exists yet
  if (!fs.existsSync(baselinePath)) {
    return { match: true, isNew: true };
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));

  const { width, height } = baseline;

  // Size mismatch
  if (current.width !== width || current.height !== height) {
    console.error(`${colors.red}Size mismatch: baseline ${width}x${height} vs current ${current.width}x${current.height}${colors.reset}`);
    return { match: false, mismatchedPixels: -1 };
  }

  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  // Save diff image if there are differences
  if (numDiffPixels > 0) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const totalPixels = width * height;
  const diffPercentage = (numDiffPixels / totalPixels * 100).toFixed(2);

  return {
    match: numDiffPixels === 0,
    mismatchedPixels: numDiffPixels,
    diffPercentage,
  };
}

/**
 * Capture screenshot and compare with baseline
 */
async function captureScreenshot(page, viewport, view, testData = {}) {
  const filename = `${view.name}-${viewport.name}.png`;
  const currentPath = path.join(CURRENT_DIR, filename);
  const baselinePath = path.join(BASELINE_DIR, filename);
  const diffPath = path.join(DIFF_DIR, filename);

  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
  });

  // Build URL with test data if needed
  let url = `${FRONTEND_URL}${view.path}`;
  if (view.needsData && testData[view.name]) {
    url = url.replace(':id', testData[view.name]);
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for React to render
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: currentPath, fullPage: true });

    // Update baseline mode
    if (UPDATE_BASELINE) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`${colors.green}✓ BASELINE UPDATED${colors.reset}: ${filename}`);
      return { success: true, updated: true };
    }

    // Compare with baseline
    const comparison = await compareImages(baselinePath, currentPath, diffPath);

    if (comparison.isNew) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`${colors.green}✓ NEW BASELINE${colors.reset}: ${filename}`);
      return { success: true, isNew: true };
    } else if (comparison.match) {
      console.log(`${colors.green}✓ PASS${colors.reset}: ${filename}`);
      return { success: true };
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset}: ${filename} - ${comparison.mismatchedPixels} pixels differ (${comparison.diffPercentage}%)`);
      console.log(`  Diff saved to: ${diffPath}`);
      return { success: false, ...comparison };
    }
  } catch (error) {
    console.error(`${colors.red}✗ ERROR${colors.reset}: ${filename} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch test data IDs from API
 */
async function getTestData(page) {
  try {
    // Get first destination ID
    const destinationsResponse = await page.evaluate(async () => {
      const res = await fetch('/api/destinations');
      return res.json();
    });

    // Get first experience ID
    const experiencesResponse = await page.evaluate(async () => {
      const res = await fetch('/api/experiences');
      return res.json();
    });

    const testData = {};

    // Support paginated responses ({ data, meta }) or legacy arrays
    const dests = Array.isArray(destinationsResponse)
      ? destinationsResponse
      : (destinationsResponse && destinationsResponse.data) || [];

    const exps = Array.isArray(experiencesResponse)
      ? experiencesResponse
      : (experiencesResponse && experiencesResponse.data) || [];

    if (dests.length > 0) {
      testData['single-destination'] = dests[0]._id;
    }

    if (exps.length > 0) {
      testData['single-experience'] = exps[0]._id;
    }

    return testData;
  } catch (error) {
    console.warn(`${colors.yellow}Warning: Could not fetch test data${colors.reset}`, error.message);
    return {};
  }
}

/**
 * Main test runner
 */
async function runVisualTests() {
  console.log('=========================================');
  console.log('Biensperience Visual Regression Tests');
  console.log('=========================================');
  console.log('');
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Update Baseline: ${UPDATE_BASELINE}`);
  console.log(`JWT Token: ${JWT_TOKEN ? 'Provided' : 'Not provided'}`);
  console.log('');

  ensureDirectories();

  let browser;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set auth cookie for authenticated routes
    await setAuthCookie(page);

    // Fetch test data IDs
    const testData = await getTestData(page);

    // Run tests for each viewport
    for (const viewport of VIEWPORTS) {
      console.log(`\n${colors.blue}Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})${colors.reset}`);

      for (const view of VIEWS) {
        // Skip views that need data if we don't have it
        if (view.needsData && !testData[view.name]) {
          console.log(`${colors.yellow}⊘ SKIP${colors.reset}: ${view.name} (no test data available)`);
          continue;
        }

        const result = await captureScreenshot(page, viewport, view, testData);

        if (result.success) {
          testsPassed++;
        } else {
          testsFailed++;
        }
      }
    }

    console.log('\n=========================================');
    console.log('Visual Tests Summary');
    console.log('=========================================');
    console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
    console.log(`Total: ${testsPassed + testsFailed}`);
    console.log('');

    if (testsFailed > 0) {
      console.log(`${colors.red}Some visual tests failed. Check diff images in: ${DIFF_DIR}${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`${colors.green}All visual tests passed!${colors.reset}`);
      process.exit(0);
    }

  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  runVisualTests();
}

module.exports = { runVisualTests, captureScreenshot, compareImages };
