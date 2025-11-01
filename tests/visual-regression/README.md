# Visual Regression Testing

Automated visual regression testing for Biensperience using Puppeteer and pixelmatch.

## Overview

This test suite captures screenshots of the application at various viewports and compares them against baseline images to detect visual regressions.

## Features

- **Automated Test User Creation**: Creates and cleans up test users automatically
- **JWT Authentication**: Obtains JWT tokens for testing authenticated routes
- **Multi-Viewport Testing**: Tests mobile (375x812), tablet (768x1024), and desktop (1920x1080) viewports
- **Pixel-Perfect Comparison**: Uses pixelmatch for precise image comparison
- **Baseline Management**: Easy baseline creation and updates
- **Diff Generation**: Automatically generates diff images for failures

## Files

- **test-ui.js**: Main Puppeteer test runner
- **setup-test-user.js**: Test user creation and JWT token acquisition
- **run-tests.sh**: Bash orchestration script
- **screenshots/**:
  - **baseline/**: Reference screenshots (committed to git)
  - **current/**: Latest test run screenshots (ignored by git)
  - **diff/**: Difference images for failures (ignored by git)

## Prerequisites

- Node.js and npm installed
- MongoDB running locally (or accessible via MONGODB_URI)
- Backend server running on http://localhost:3001 (or custom BACKEND_URL)
- Frontend server running on http://localhost:3000 (or custom FRONTEND_URL)

Dependencies are installed automatically with `npm install`:
- puppeteer
- pngjs
- pixelmatch

## Usage

### Run Visual Tests

```bash
# Via npm scripts (recommended)
npm run test:visual

# Or directly
./tests/visual-regression/run-tests.sh
```

### Update Baseline Screenshots

When you've made intentional visual changes:

```bash
# Via npm
npm run test:visual:update

# Or directly
./tests/visual-regression/run-tests.sh --update-baseline
```

### Cleanup Only

Remove test user without running tests:

```bash
./tests/visual-regression/run-tests.sh --cleanup-only
```

### Help

```bash
./tests/visual-regression/run-tests.sh --help
```

## Environment Variables

Customize the test environment with these variables:

```bash
# Backend API URL
BACKEND_URL=http://localhost:3001

# Frontend URL
FRONTEND_URL=http://localhost:3000

# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/biensperience

# Update baselines instead of comparing
UPDATE_BASELINE=true
```

Example:

```bash
BACKEND_URL=http://staging:3001 FRONTEND_URL=http://staging:3000 npm run test:visual
```

## Test Views

The following views are tested:

1. **home** (`/`) - Public homepage
2. **app-home** (`/app`) - Authenticated app home
3. **destinations** (`/destinations`) - Destinations list
4. **experiences** (`/experiences`) - Experiences list
5. **profile** (`/profile`) - User profile
6. **single-destination** (`/destinations/:id`) - Single destination view (if data exists)
7. **single-experience** (`/experiences/:id`) - Single experience view (if data exists)

Each view is tested at 3 viewports (mobile, tablet, desktop) for a total of up to 21 screenshots per run.

## Test Workflow

1. **Setup**: Creates test user and obtains JWT token
2. **Test**: Captures screenshots and compares with baselines
3. **Cleanup**: Removes test user from database

## Interpreting Results

### Success

```
✓ PASS: home-desktop.png
```

Screenshot matches baseline perfectly.

### New Baseline

```
✓ NEW BASELINE: home-desktop.png
```

No baseline existed, created one from current screenshot.

### Failure

```
✗ FAIL: home-desktop.png - 1234 pixels differ (2.34%)
  Diff saved to: tests/visual-regression/screenshots/diff/home-desktop.png
```

Visual regression detected. Check the diff image to see what changed.

### Skip

```
⊘ SKIP: single-destination (no test data available)
```

View requires data that doesn't exist in the database.

## Baseline Management

### When to Update Baselines

Update baselines when you've made intentional changes:

- New features added to UI
- Design updates
- Layout changes
- Component updates

### How to Review Changes

1. Run normal test to see failures
2. Review diff images in `screenshots/diff/`
3. If changes are intentional, run `npm run test:visual:update`
4. Commit updated baseline images

### Best Practices

- Always review diffs before updating baselines
- Commit baseline updates with related code changes
- Document visual changes in commit messages
- Run visual tests in CI/CD pipelines

## Troubleshooting

### Tests Fail Due to Timing

Increase wait time in test-ui.js:

```javascript
await page.waitForTimeout(1000); // Increase this value
```

### Backend/Frontend Not Running

```
Error: net::ERR_CONNECTION_REFUSED
```

Ensure backend and frontend servers are running:

```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm start
```

### JWT Token Errors

```
Warning: No JWT_TOKEN provided, authenticated routes may fail
```

Check that:
- Backend is running
- Login endpoint is accessible
- Test user credentials are correct

### MongoDB Connection Errors

```
Error creating test user: MongoServerSelectionError
```

Ensure MongoDB is running:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Check connection
mongosh
```

### Permission Denied

```
bash: ./tests/visual-regression/run-tests.sh: Permission denied
```

Make script executable:

```bash
chmod +x tests/visual-regression/run-tests.sh
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Start MongoDB
  uses: supercharge/mongodb-github-action@1.10.0

- name: Install dependencies
  run: npm ci

- name: Build frontend
  run: npm run build

- name: Start backend
  run: npm run server &

- name: Start frontend
  run: npm start &

- name: Wait for servers
  run: sleep 10

- name: Run visual regression tests
  run: npm run test:visual

- name: Upload diff images
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression-diffs
    path: tests/visual-regression/screenshots/diff/
```

## Development

### Adding New Views

Edit `VIEWS` array in test-ui.js:

```javascript
const VIEWS = [
  // ... existing views
  {
    name: 'new-view',
    path: '/new-path',
    requiresAuth: true,
    needsData: false
  },
];
```

### Adding New Viewports

Edit `VIEWPORTS` array in test-ui.js:

```javascript
const VIEWPORTS = [
  // ... existing viewports
  { name: '4k', width: 3840, height: 2160 },
];
```

### Customizing Comparison Threshold

Adjust pixelmatch threshold in test-ui.js:

```javascript
const numDiffPixels = pixelmatch(
  baseline.data,
  current.data,
  diff.data,
  width,
  height,
  { threshold: 0.1 } // 0.0 = exact match, 1.0 = very lenient
);
```

## License

Same as parent project (Biensperience).
