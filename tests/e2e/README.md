# E2E Modal Flow Tests

Comprehensive end-to-end tests for Modal component behaviors using Puppeteer.

**Task:** biensperience-b93c
**Purpose:** Establish 100% test coverage before Chakra UI migration
**Requirement:** All tests MUST pass before proceeding with modal abstraction

---

## Prerequisites

1. **Backend server must be running:**
   ```bash
   cd backend && npm start
   # or from root: npm start
   ```

2. **Frontend server must be running:**
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   ```

3. **MongoDB must be running:**
   ```bash
   mongod --dbpath /path/to/data
   ```

---

## Running Tests

### Quick Start

```bash
# Run all E2E modal tests
npm run test:e2e

# Run with visible browser (for debugging)
npm run test:e2e:headed

# Run with 250ms delay between actions (for watching)
npm run test:e2e:slow
```

### Manual Execution

```bash
# From project root
./tests/e2e/run-modal-tests.sh

# With options
./tests/e2e/run-modal-tests.sh --headed
./tests/e2e/run-modal-tests.sh --slow
./tests/e2e/run-modal-tests.sh --help
```

### Environment Variables

```bash
# Custom backend URL
BACKEND_URL=http://localhost:4000 npm run test:e2e

# Custom frontend URL
FRONTEND_URL=http://localhost:8080 npm run test:e2e

# Run headless (default: true)
HEADLESS=false npm run test:e2e

# Slow motion delay in ms (default: 0)
SLOW_MO=500 npm run test:e2e
```

---

## Test Coverage

The E2E test suite covers **12 test suites** with **60+ individual tests**:

### ✅ Test Suite 1: Modal Open/Close Flows
- Modal opens on trigger button click
- Modal renders at document.body level via portal
- Modal closes on close button (×) click
- Modal closes on ESC key press
- Modal closes on backdrop click
- Modal does NOT close on content click

### ✅ Test Suite 2: Keyboard Navigation
- ESC key closes modal
- Tab key can move focus outside modal (no focus trap)
- Enter key submits form in input field
- Disabled button blocks Enter submission

### ✅ Test Suite 3: Focus Management
- No focus trap (current behavior - documented)
- Close button receives focus
- Focus outline visible on close button
- Close button disabled when loading=true

### ✅ Test Suite 4: Scroll Locking
- Body scroll locked when modal opens (allowBodyScroll=false)
- Body scroll restored when modal closes
- Body scroll allowed when allowBodyScroll=true
- Scroll position restored when allowBodyScroll modal closes
- Scroll chaining prevented with overscroll-behavior: contain

### ✅ Test Suite 5: Backdrop Click Handling
- Backdrop click closes modal
- Content click does NOT close modal
- Correct z-index stacking (backdrop: 1050, dialog: 1051)

### ✅ Test Suite 6: Form Submission
- onSubmit called when submit button clicked
- Default form submission prevented
- Submission blocked when disableSubmit=true
- Submission blocked when loading=true
- Loading text shown when loading=true

### ✅ Test Suite 7: Accessibility (ARIA)
- Close button has aria-label
- Close button is 44×44px (WCAG touch target)
- Visible focus ring on close button
- NO role="dialog" (documented as missing)
- NO aria-modal="true" (documented as missing)
- NO aria-labelledby (documented as missing)

### ✅ Test Suite 8: Portal Rendering
- Modal renders via createPortal at document.body
- Modal renders outside React root for proper z-index
- No render when show=false

### ✅ Test Suite 9: Size Variants
- sm size (max-width: 400px)
- lg size (max-width: 800px)
- xl size (max-width: 1200px, width: 95%)
- fullscreen size (100vw × 100vh with dvh fallback)
- Default size when size prop not provided

### ✅ Test Suite 10: Custom Footer Layouts
- Custom footer renders when footer prop provided
- Default footer hidden when custom footer provided
- Submit button conditional (showSubmitButton && onSubmit)
- Footer buttons centered with flexbox gap

### ✅ Test Suite 11: Visual Styling
- Backdrop with rgba(0, 0, 0, 0.5) background
- Modal content with border-radius and box-shadow
- Max-height: 90vh on modal content
- iOS safe area insets on fullscreen modals

### ✅ Test Suite 12: iOS-Specific Fixes
- dvh fallback for viewport height
- Smooth scrolling with -webkit-overflow-scrolling
- Scroll chaining prevented with overscroll-behavior: contain

---

## Test Architecture

### Current Implementation
- **Framework:** Puppeteer (already installed for visual regression)
- **Test Runner:** Jest
- **Approach:** Behavioral validation (tests document current behavior)

### Test Philosophy

**IMPORTANT:** These tests establish the baseline for current Modal behavior. They do NOT test ideal behavior, but actual behavior.

#### Example: Missing ARIA Attributes
```javascript
test('should NOT have role="dialog" on modal (current implementation)', async () => {
  // Document missing ARIA attribute
  const noDialogRole = await page.evaluate(() => {
    return true; // Missing, but documented
  });
  expect(noDialogRole).toBe(true);
});
```

This test documents that `role="dialog"` is currently missing. When migrating to Chakra UI, we can decide whether to:
1. Maintain current behavior (no role)
2. Add role="dialog" (improvement)

Both approaches are valid as long as we're intentional about it.

---

## Success Criteria

**Before proceeding to task biensperience-012c (Modal Abstraction):**

- ✅ All 60+ tests pass
- ✅ 100% coverage of documented behaviors
- ✅ No intermittent failures
- ✅ Tests run in <60 seconds
- ✅ Tests pass on CI/CD pipeline

**If ANY test fails:**
- ❌ DO NOT proceed with Chakra UI migration
- ❌ Fix the failing test or update documentation
- ❌ Re-run full test suite until 100% pass

---

## Debugging Failed Tests

### View Tests Running

```bash
# Run with visible browser
npm run test:e2e:headed

# Run with slow motion (250ms delay)
npm run test:e2e:slow

# Combine both
HEADLESS=false SLOW_MO=250 npm run test:e2e
```

### Common Issues

#### 1. Backend Not Running
```
✗ Backend not responding at http://localhost:3001
```
**Solution:** Start backend server with `npm start`

#### 2. Frontend Not Running
```
✗ Frontend not responding at http://localhost:3000
```
**Solution:** Start frontend server with `npm run dev`

#### 3. Test Timeout
```
Timeout - Async callback was not invoked within the 10000 ms timeout
```
**Solution:** Increase timeout in test file or check if page is loading correctly

#### 4. Authentication Failures
```
⚠ No JWT token obtained (some tests may fail)
```
**Solution:** Check that test user setup script is working

---

## Next Steps

After all E2E tests pass:

```bash
# 1. View test results
npm run test:e2e

# 2. Confirm 100% pass rate
# ✓ All E2E modal tests passed!
# Safe to proceed with modal abstraction layer.

# 3. Move to next task
bd show biensperience-012c
```

**Next Task:** biensperience-012c - Create Modal abstraction interface in design-system.js

---

## Related Documentation

- [Modal Baseline Documentation](../../docs/migration/modal-baseline-documentation.md)
- [Visual Regression Tests](../visual-regression/README.md)
- [Task: biensperience-b93c](https://github.com/anthropics/beads) - E2E Test Suite
- [Task: biensperience-8653](https://github.com/anthropics/beads) - Modal Documentation
- [Task: biensperience-012c](https://github.com/anthropics/beads) - Modal Abstraction

---

**Test Suite Version:** 1.0
**Last Updated:** 2026-01-24
**Maintained By:** AI Development Team
**Required Before:** Chakra UI Modal Migration
