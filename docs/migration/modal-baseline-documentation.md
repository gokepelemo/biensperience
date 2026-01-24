# Modal Component Baseline Documentation

**Date:** 2026-01-24
**Purpose:** Complete behavioral and visual documentation of the current Modal component before Chakra UI migration
**Task:** biensperience-8653
**Status:** ✅ BASELINE ESTABLISHED

---

## 📊 Executive Summary

The Modal component is a critical UI element used **64 times** across the application. It uses Bootstrap's modal pattern with React Portal rendering and custom SCSS modules. This document establishes the baseline for zero-regression migration to Chakra UI.

**Key Statistics:**
- **Total Modal Usages:** 64 files
- **Size Distribution:** sm (158), lg (80), md (79), xl (14), fullscreen (2)
- **Rendering Method:** `createPortal(modalContent, document.body)`
- **z-index:** 1050 (backdrop), 1051 (dialog)
- **Focus Management:** Custom `useModalEscape` hook

---

## 🎯 Modal Component API

### Core Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `show` | boolean | - | ✅ Yes | Controls modal visibility |
| `onClose` | function | - | ✅ Yes | Callback when modal closes |
| `onSubmit` | function | - | ❌ No | Callback for form submission |
| `title` | node | - | ❌ No | Modal title (supports JSX) |
| `children` | node | - | ❌ No | Modal body content |
| `submitText` | string | "Submit" | ❌ No | Submit button text |
| `submitVariant` | string | "primary" | ❌ No | Bootstrap variant for submit button |
| `cancelText` | string | "Cancel" | ❌ No | Cancel button text |
| `showCancelButton` | boolean | true | ❌ No | Show cancel button (not used in current impl) |
| `showSubmitButton` | boolean | true | ❌ No | Show submit button |
| `disableSubmit` | boolean | false | ❌ No | Disable submit button |
| `loading` | boolean | false | ❌ No | Show loading state on submit button |
| `size` | string | undefined | ❌ No | Modal size: 'sm', 'lg', 'xl', 'fullscreen' |
| `scrollable` | boolean | false | ❌ No | Enable body scrolling |
| `centered` | boolean | true | ❌ No | Center modal vertically |
| `footer` | node | - | ❌ No | Custom footer content (replaces default) |
| `dialogClassName` | string | "" | ❌ No | Custom class for modal dialog |
| `contentClassName` | string | "" | ❌ No | Custom class for modal content |
| `bodyClassName` | string | "" | ❌ No | Custom class for modal body |
| `icon` | node | - | ❌ No | Icon to display before title |
| `showHeader` | boolean | true | ❌ No | Show modal header |
| `allowBodyScroll` | boolean | false | ❌ No | Allow page scrolling (absolute positioning) |

---

## 📐 Size Variants & Dimensions

### Small (sm)
- **Max Width:** 400px
- **Use Cases:** Simple dialogs, confirmations, date pickers
- **Usage Count:** 158 occurrences
- **Examples:**
  - ConfirmModal (delete confirmations)
  - DatePickerSection (plan date selection)
  - ForgotPasswordModal
  - DeleteAccountModal

**Visual Characteristics:**
```
┌──────────────────────────────────┐
│  Icon  Title              ×      │ ← Header: 16px padding top/bottom, 24px left/right
├──────────────────────────────────┤
│                                  │
│  Body Content                    │ ← Body: auto height, max 90vh
│  (max-width: 400px)              │
│                                  │
├──────────────────────────────────┤
│         Cancel    Submit         │ ← Footer: centered buttons, 16px padding, gap: 12px
└──────────────────────────────────┘
```

### Medium (default, no size specified)
- **Max Width:** 500px (Bootstrap default)
- **Use Cases:** Standard forms, single-field modals
- **Usage Count:** 79 occurrences
- **Examples:**
  - LoginForm
  - SignUpForm
  - AddLocationModal
  - AddDateModal

### Large (lg)
- **Max Width:** 800px
- **Use Cases:** Multi-field forms, lists, moderate content
- **Usage Count:** 80 occurrences
- **Examples:**
  - NewExperience wizard
  - UpdateExperience
  - CollaboratorModal
  - TransferOwnershipModal

### Extra Large (xl)
- **Max Width:** 1200px
- **Viewport Width:** 95% on mobile
- **Use Cases:** Complex forms, document viewers, detailed content
- **Usage Count:** 14 occurrences
- **Examples:**
  - PlanItemModal (complex plan item editor)
  - DocumentViewerModal
  - AddPlanItemDetailModal

### Fullscreen
- **Dimensions:** 100vw × 100vh (with dvh fallback)
- **Padding:** 0 (fills entire viewport)
- **Use Cases:** Immersive experiences, mobile detail views
- **Usage Count:** 2 occurrences
- **Examples:**
  - **PlanItemDetailsModal** (with `allowBodyScroll={true}`)
  - GoogleMap modal

**Critical Fullscreen Behavior:**
```scss
// Fullscreen modal fills 100% of viewport
.modalFullscreen {
  width: 100%;
  height: 100vh; // with dvh fallback
  margin: 0;
  padding: 0;

  // iOS safe area insets
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);

  // Flex layout for vertical stacking
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
}
```

---

## 🎨 Visual Styling & Theming

### Backdrop
- **Background:** `rgba(0, 0, 0, 0.5)` or `var(--color-bg-overlay)`
- **Position:** fixed, full viewport
- **z-index:** 1050
- **Click Behavior:** Closes modal when clicked

### Modal Dialog
- **Border Radius:** `$radius-lg` (~12px from design tokens)
- **Box Shadow:** `$shadow-lg` (large elevation shadow)
- **Background:** `var(--color-bg-primary)`
- **Max Height:** 90vh
- **Padding:** `$space-4` (16px) around dialog when centered

### Header
- **Padding:** `$space-4 $space-6` (16px vertical, 24px horizontal)
- **Border Bottom:** 1px solid `var(--color-border-light)`
- **Title Font:** `$font-size-lg`, `$font-weight-semibold`
- **Close Button:**
  - Size: 44×44px (WCAG touch target)
  - Font size: 24px
  - Opacity: 0.7 (hover: 1.0)
  - Focus ring: 3px `var(--color-primary-alpha-20)`
  - Disabled opacity: 0.3

**Gradient Header Variant** (opt-in via `.modalGradientHeader`):
- Background: `var(--gradient-primary)`
- Text color: white
- Close button: white, semi-transparent hover

### Body
- **Padding:** inherited from Bootstrap `.modal-body`
- **Scroll Behavior:** `overscroll-behavior: contain` (prevents scroll chaining)
- **Scrollable Variant:**
  - `overflow-y: auto`
  - `max-height: calc(90vh - 120px)`

### Footer
- **Layout:** Flex, centered, gap: `$space-3` (12px)
- **Padding:** `$space-4 $space-6` (16px vertical, 24px horizontal)
- **Border Top:** 1px solid `var(--color-border-medium)`
- **Background:** `var(--color-bg-secondary)` (light mode), `var(--color-bg-tertiary)` (dark mode)
- **Border Radius:** 0 0 `$radius-md` `$radius-md`

---

## ⚡ Behavioral Specifications

### Portal Rendering
```javascript
return createPortal(modalContent, document.body);
```

**Critical Behavior:**
- Modal is **always** rendered at `document.body` level
- Ensures proper z-index stacking above all other content
- Avoids CSS overflow/position issues from parent containers

### Scroll Locking

**Standard Mode** (`allowBodyScroll={false}`, default):
```javascript
// When modal opens
document.body.style.overflow = 'hidden';
scrollYRef.current = window.scrollY;

// When modal closes
document.body.style.overflow = '';
// No scroll position restoration in standard mode
```

**Document Scroll Mode** (`allowBodyScroll={true}`):
```javascript
// When modal opens
document.body.style.overflow = '';
window.scrollTo(0, 0); // Scroll to top
scrollYRef.current = window.scrollY; // Save position

// When modal closes
document.body.style.overflow = '';
window.scrollTo(0, scrollYRef.current || 0); // Restore position
```

**Use Cases for `allowBodyScroll`:**
- PlanItemDetailsModal (fullscreen mobile view with long content)
- Modals that exceed viewport height and need page-level scrolling

### Focus Management

**ESC Key Handling:**
```javascript
useModalEscape(onClose, show);
```
- Custom hook listens for ESC key
- Calls `onClose()` when ESC pressed
- Only active when `show={true}`

**Focus Trap:** ⚠️ **NOT IMPLEMENTED**
- Current modal does NOT trap focus within modal
- Tab key can move focus outside modal to page content
- **REGRESSION RISK:** Must preserve this behavior or implement focus trap consistently

### Backdrop Click Handling
```javascript
const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    onClose();
  }
};
```
- Only closes if backdrop itself is clicked
- Clicking modal content does NOT close modal
- Prevents accidental closures

### Form Submission
```javascript
const handleSubmit = (e) => {
  e.preventDefault();
  if (onSubmit && !disableSubmit && !loading) {
    onSubmit(e);
  }
};
```
- Prevents default form submission
- Respects `disableSubmit` and `loading` states
- Only calls `onSubmit` if provided

---

## 🎭 Animation & Transitions

### Current Implementation
**NO ANIMATIONS** in current version:
- Modal appears/disappears instantly
- No fade-in/fade-out transitions
- No slide animations
- No scale/zoom effects

**CSS Transition Properties:**
```scss
.btnClose {
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
}
```
- Only close button has transitions
- `--transition-fast` is typically `150ms ease-in-out`

**⚠️ CRITICAL FOR CHAKRA MIGRATION:**
- Chakra UI modals have default animations (fade, scale)
- Must disable or match animations to avoid regression
- Users expect instant modal appearance

---

## ♿ Accessibility Features

### ARIA Attributes
```javascript
<div tabIndex="-1" onClick={handleBackdropClick}>
  <button aria-label={lang.current.aria.close} disabled={loading}>
```

**Current Accessibility:**
- ✅ Close button has `aria-label`
- ✅ Close button is `44×44px` (WCAG touch target)
- ✅ Focus outline on close button (`3px` ring)
- ⚠️ **MISSING:** `role="dialog"` on modal container
- ⚠️ **MISSING:** `aria-modal="true"` attribute
- ⚠️ **MISSING:** `aria-labelledby` pointing to title
- ⚠️ **MISSING:** `aria-describedby` for body content
- ⚠️ **MISSING:** Focus trap (focus can escape modal)
- ⚠️ **MISSING:** Initial focus management (should focus first focusable element)

### Keyboard Navigation
| Key | Behavior |
|-----|----------|
| ESC | Closes modal (via `useModalEscape` hook) |
| Tab | **NO FOCUS TRAP** - can tab outside modal |
| Enter | Submits form if inside form element |

### Screen Reader Considerations
- Title is readable as `<h5>` heading
- Body content is in semantic `<div class="modal-body">`
- Footer buttons are standard `<button>` elements
- **ISSUE:** Modal opening is NOT announced to screen readers

---

## 📱 Responsive Behavior

### Mobile Breakpoints
```scss
@include breakpoint-max(sm) { // < 576px
  .modalDialog {
    max-width: 90%;
    margin: 0 auto;
  }

  .modalLg, .modalXl {
    max-width: 90%;
  }
}
```

### iOS-Specific Fixes

**Safari Address Bar Handling:**
```scss
// Use dvh (dynamic viewport height) with fallback
height: 100%;
height: 100dvh;
```

**Safe Area Insets (fullscreen only):**
```scss
padding-top: env(safe-area-inset-top, 0);
padding-bottom: env(safe-area-inset-bottom, 0);
padding-left: env(safe-area-inset-left, 0);
padding-right: env(safe-area-inset-right, 0);
```

**Smooth Scrolling:**
```scss
-webkit-overflow-scrolling: touch;
overscroll-behavior: contain;
```

---

## 🔍 Modal Consumers Inventory

### High-Priority Modals (Test First)

| Component | Size | Custom Features | Complexity |
|-----------|------|-----------------|------------|
| **PlanItemDetailsModal** | fullscreen | allowBodyScroll, tabs, chat, forms | ⭐⭐⭐⭐⭐ |
| **DatePickerSection** | sm | Custom footer, date picker | ⭐⭐ |
| **ConfirmModal** | sm | Custom footer, variant styling | ⭐⭐⭐ |
| **DocumentViewerModal** | xl | PDF viewer, fullscreen toggle | ⭐⭐⭐⭐ |
| **CollaboratorModal** | lg | User search, permissions | ⭐⭐⭐ |
| **PhotoModal** | Special | Photo gallery, keyboard nav | ⭐⭐⭐⭐ |

### All Modal Consumers (64 files)

<details>
<summary>Click to expand full list</summary>

1. ActivityMonitor/ActivityMonitor.jsx
2. AddDateModal/AddDateModal.jsx
3. AddDetailTypeModal/AddDetailTypeModal.jsx
4. AddLocationModal/AddLocationModal.jsx
5. AddPlanItemDetailModal/AddPlanItemDetailModal.jsx
6. AlertModal/AlertModal.jsx
7. AssignPlanItemModal/AssignPlanItemModal.jsx
8. ChatModal/ChatModal.jsx
9. ConfirmModal/ConfirmModal.jsx
10. CookiePolicyModal/CookiePolicyModal.jsx
11. CostEntry/CostEntry.jsx
12. CostsList/CostsList.jsx
13. CuratorPlanners/CuratorPlanners.jsx
14. Dashboard/Preferences.jsx
15. DeleteAccountModal/DeleteAccountModal.jsx
16. DocumentViewerModal/DocumentViewerModal.jsx
17. DocumentsTab.jsx (PlanItemDetailsModal)
18. ExperienceCard/ExperienceCard.jsx
19. ExperienceWizardModal/ExperienceWizardModal.jsx
20. FavoriteDestination/FavoriteDestination.jsx
21. ForgotPasswordModal/ForgotPasswordModal.jsx
22. GoogleMap/GoogleMap.jsx
23. LegalModalsHandler/LegalModalsHandler.jsx
24. LoginForm/LoginForm.jsx
25. MultiStepPlanModal/MultiStepPlanModal.jsx
26. NewDestination/NewDestination.jsx
27. NewDestinationModal/NewDestinationModal.jsx
28. NewExperience/NewExperience.jsx
29. NewPlanItem/NewPlanItem.jsx
30. PhotoCard/PhotoCard.jsx
31. PhotosTab.jsx (PlanItemDetailsModal)
32. PhotoUpload/PhotoUpload.jsx
33. PlanItemDetailsModal/PlanItemDetailsModal.jsx ⭐
34. PlanItemModal.jsx (SingleExperience)
35. PlanItemNotes/PlanItemNotes.jsx
36. PrivacyPolicyModal/PrivacyPolicyModal.jsx
37. RequestPlanAccessModal/RequestPlanAccessModal.jsx
38. SignUpForm/SignUpForm.jsx
39. SingleDestination/SingleDestination.jsx
40. SingleExperience/CollaboratorModal.jsx
41. SingleExperience/DatePickerSection.jsx ⭐
42. SingleExperience/MyPlanTabContent.jsx
43. SingleExperience/SyncPlanModal.jsx
44. SingleExperience/SingleExperience.jsx
45. SuccessModal/SuccessModal.jsx
46. TermsOfServiceModal/TermsOfServiceModal.jsx
47. TransferOwnershipModal/TransferOwnershipModal.jsx
48. TwoFactorAuthModal/TwoFactorAuthModal.jsx
49. UpdateDestination/UpdateDestination.jsx
50. UpdateExperience/UpdateExperience.jsx
51. UpdateProfile.jsx (Profile)
52. AllUsers/AllUsers.jsx
53. App/App.jsx
54. Dashboard/Dashboard.jsx
55. InviteTracking/InviteTracking.jsx
56. Profile/Profile.jsx
57. DestinationWizardContext.jsx
58. ExperienceWizardContext.jsx
59. Stories: AuthenticationPatterns.stories.jsx
60. Stories: CollaboratorModal.stories.jsx
61. Stories: ConfirmModal.stories.jsx
62. Stories: DocumentViewerModal.stories.jsx
63. Stories: SuccessModal.stories.jsx
64. Modal.md (documentation)

</details>

---

## 🚨 Critical Regression Risks

### 1. **PlanItemDetailsModal Breaking** (REPORTED ISSUE)
**Symptoms:** Modal doesn't trigger or renders inside component instead of document.body

**Root Cause (Likely):**
- Missing `createPortal` in Chakra implementation
- z-index conflicts
- Fullscreen + allowBodyScroll combination not replicated

**Required Tests:**
- ✅ Modal renders at document.body level
- ✅ Fullscreen mode fills viewport
- ✅ allowBodyScroll enables page scrolling
- ✅ Scroll position restores on close
- ✅ Tabs, chat, forms all function correctly

### 2. **Update Date Modal Scoped to Component** (REPORTED ISSUE)
**Symptoms:** Modal renders inside parent instead of full window overlay

**Root Cause (Likely):**
- Portal rendering not working
- CSS positioning issue (absolute vs fixed)

**Required Tests:**
- ✅ Modal renders at document.body
- ✅ Backdrop covers entire viewport
- ✅ Modal is centered in viewport
- ✅ z-index is correct (above all content)

### 3. **Focus Management**
**Risk:** Adding focus trap where none existed causes UX regression

**Mitigation:**
- Document current "no focus trap" behavior
- Decide: add focus trap or maintain current behavior
- Test all modals for focus issues

### 4. **Scroll Locking**
**Risk:** Scroll lock doesn't work on iOS or causes jump

**Mitigation:**
- Test on iOS Safari (address bar handling)
- Verify `overscroll-behavior: contain`
- Test scroll position restoration

### 5. **Size Variants**
**Risk:** Chakra size props don't match Bootstrap sizes

**Mapping Required:**
```
Bootstrap → Chakra
sm (400px) → sm or xs?
md (500px) → md
lg (800px) → lg or xl?
xl (1200px) → 2xl or 3xl?
fullscreen → full
```

### 6. **Custom Footer Layouts**
**Risk:** Custom footer components break due to Chakra's DialogFooter wrapper

**Critical Examples:**
- DatePickerSection: 3 buttons (Skip, Cancel, Submit)
- ConfirmModal: Dynamic footer (Close or Cancel+Confirm)

**Mitigation:**
- Test all custom footer variants
- Ensure Chakra DialogFooter accepts custom children

---

## ✅ Test Coverage Requirements

### Unit Tests
- [ ] Modal renders with all prop combinations
- [ ] Size variants apply correct max-width
- [ ] Scroll locking works (body overflow hidden)
- [ ] ESC key closes modal
- [ ] Backdrop click closes modal
- [ ] Submit button disabled when loading
- [ ] Custom footer replaces default footer
- [ ] Icon renders before title
- [ ] allowBodyScroll changes positioning

### Integration Tests
- [ ] ConfirmModal: Danger variant, custom footer
- [ ] DatePickerSection: Date picker, Skip button
- [ ] PlanItemDetailsModal: Fullscreen, tabs, forms
- [ ] DocumentViewerModal: PDF rendering
- [ ] CollaboratorModal: User search, permissions

### E2E Tests (Playwright/Cypress)
- [ ] Modal opens on button click
- [ ] Modal closes on ESC key
- [ ] Modal closes on backdrop click
- [ ] Modal does NOT close on content click
- [ ] Form submission works
- [ ] Fullscreen modal fills viewport
- [ ] Mobile: modal is responsive
- [ ] iOS: Safari address bar handling
- [ ] Screen reader: modal is announced
- [ ] Keyboard: Tab navigation (current: no focus trap)

### Visual Regression Tests
- [ ] Screenshot baseline for each size variant
- [ ] Screenshot baseline for custom footers
- [ ] Screenshot baseline for gradient header
- [ ] Screenshot baseline for fullscreen
- [ ] Screenshot baseline for scrollable body
- [ ] Dark mode screenshots
- [ ] Mobile screenshots (320px, 375px, 768px)

---

## 📝 Migration Checklist

### Phase 1: Pre-Migration
- [x] Document all Modal behaviors (this file)
- [x] Catalog all 64 modal usages
- [x] Identify critical regression risks
- [ ] Create E2E test suite (biensperience-b93c)
- [ ] Create visual regression baseline

### Phase 2: Abstraction
- [ ] Create design-system Modal wrapper (biensperience-012c)
- [ ] Wrap current Bootstrap Modal
- [ ] Export from design-system index
- [ ] Define consistent API

### Phase 3: Consumer Migration
- [ ] Update imports to design-system (biensperience-f9af)
- [ ] Test after each component migration
- [ ] Verify no behavior changes

### Phase 4: Chakra Implementation
- [ ] Implement Chakra Modal wrapper (biensperience-277f)
- [ ] Add feature flag (default: Bootstrap)
- [ ] Map all Bootstrap props to Chakra
- [ ] Replicate exact styling

### Phase 5: Validation
- [ ] Visual regression testing (biensperience-cd21)
- [ ] Fix ALL discrepancies
- [ ] 100% E2E test pass rate

### Phase 6: Rollout
- [ ] Enable Chakra as default (biensperience-0512)
- [ ] Monitor for 1 week
- [ ] Remove Bootstrap code

---

## 🔗 Related Documentation

- [Modal Component Source](../../src/components/Modal/Modal.jsx)
- [Modal SCSS Module](../../src/components/Modal/Modal.module.scss)
- [useModalEscape Hook](../../src/hooks/useKeyboardNavigation.js)
- [Design System Utilities](../../src/utilities/design-system.js)
- [Task: biensperience-8653](https://github.com/anthropics/beads) - Document Modal Behaviors
- [Task: biensperience-b93c](https://github.com/anthropics/beads) - E2E Test Suite
- [Task: biensperience-012c](https://github.com/anthropics/beads) - Modal Abstraction
- [Task: biensperience-f9af](https://github.com/anthropics/beads) - Consumer Migration
- [Task: biensperience-277f](https://github.com/anthropics/beads) - Chakra Implementation
- [Task: biensperience-cd21](https://github.com/anthropics/beads) - Visual Regression
- [Task: biensperience-0512](https://github.com/anthropics/beads) - Rollout

---

**Document Version:** 1.0
**Last Updated:** 2026-01-24
**Maintained By:** AI Development Team
**Review Required Before:** Chakra UI Modal Migration
