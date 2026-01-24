# Modal Abstraction Layer

**Status:** ✅ Phase 1 Complete - Bootstrap Wrapper
**Task:** biensperience-012c
**Next:** biensperience-f9af (Consumer Migration)

---

## Overview

The Modal abstraction layer provides a stable API for modal usage across the Biensperience application. It wraps the underlying modal implementation to enable seamless UI framework transitions without breaking consumer code.

**Current Implementation:** Bootstrap Modal (via `createPortal`)
**Future Implementation:** Chakra UI Dialog (feature-flagged)

---

## Why This Abstraction Exists

### Problem
Direct imports from `../Modal/Modal` create tight coupling:
```javascript
// ❌ BAD - Tightly coupled to Bootstrap implementation
import Modal from '../Modal/Modal';
```

When migrating to Chakra UI, we'd need to:
- Update 64 files
- Risk introducing regressions
- Coordinate massive changes

### Solution
Import from design-system abstraction:
```javascript
// ✅ GOOD - Decoupled from implementation
import { Modal } from '../components/design-system';
```

When migrating to Chakra UI:
- Update 1 file (ModalWrapper.jsx)
- Zero changes to consumers
- Feature-flagged rollout

---

## Migration Strategy (4 Phases)

### Phase 1: Abstraction Layer ✅ (Current)
**Status:** COMPLETE
**Task:** biensperience-012c

```javascript
// ModalWrapper.jsx
const ModalWrapper = (props) => {
  const useChakraModal = false; // Always Bootstrap
  return <BootstrapModal {...props} />;
};
```

**Exports:**
- `src/components/design-system.js` exports `Modal`
- Consumers can import: `import { Modal } from 'design-system'`
- No behavior changes

### Phase 2: Consumer Migration ⏳ (Next)
**Status:** PENDING
**Task:** biensperience-f9af

Update all 64 modal consumers:
```diff
- import Modal from '../Modal/Modal';
+ import { Modal } from '../components/design-system';
```

**Requirements:**
- Run E2E tests after each component migration
- Verify zero behavior changes
- Commit after each successful migration

### Phase 3: Chakra Implementation ⏳ (Future)
**Status:** PENDING
**Task:** biensperience-277f

Implement Chakra UI wrapper with feature flag:
```javascript
// ModalWrapper.jsx
const ModalWrapper = (props) => {
  const useChakraModal = useFeatureFlag('chakra_modal'); // Feature flag

  if (useChakraModal) {
    return <ChakraModalWrapper {...props} />;
  }

  return <BootstrapModal {...props} />;
};
```

**Requirements:**
- Map all Bootstrap props to Chakra Dialog
- Replicate exact visual styling
- Pass 100% of E2E tests
- Visual regression testing

### Phase 4: Rollout & Cleanup ⏳ (Future)
**Status:** PENDING
**Task:** biensperience-0512

Enable Chakra as default:
```javascript
const useChakraModal = useFeatureFlag('chakra_modal', { defaultValue: true });
```

Monitor for 1 week, then remove Bootstrap implementation.

---

## API Reference

### Props

All props from the current Bootstrap Modal implementation are supported:

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `show` | boolean | - | ✅ | Controls modal visibility |
| `onClose` | function | - | ✅ | Callback when modal closes |
| `onSubmit` | function | - | ❌ | Callback for form submission |
| `title` | node | - | ❌ | Modal title (supports JSX) |
| `children` | node | - | ❌ | Modal body content |
| `submitText` | string | "Submit" | ❌ | Submit button text |
| `submitVariant` | string | "primary" | ❌ | Submit button variant |
| `cancelText` | string | "Cancel" | ❌ | Cancel button text |
| `showCancelButton` | boolean | true | ❌ | Show cancel button |
| `showSubmitButton` | boolean | true | ❌ | Show submit button |
| `disableSubmit` | boolean | false | ❌ | Disable submit button |
| `loading` | boolean | false | ❌ | Show loading state |
| `size` | string | undefined | ❌ | Modal size: 'sm', 'lg', 'xl', 'fullscreen' |
| `scrollable` | boolean | false | ❌ | Enable body scrolling |
| `centered` | boolean | true | ❌ | Center modal vertically |
| `footer` | node | - | ❌ | Custom footer content |
| `dialogClassName` | string | "" | ❌ | Custom class for dialog |
| `contentClassName` | string | "" | ❌ | Custom class for content |
| `bodyClassName` | string | "" | ❌ | Custom class for body |
| `icon` | node | - | ❌ | Icon before title |
| `showHeader` | boolean | true | ❌ | Show modal header |
| `allowBodyScroll` | boolean | false | ❌ | Allow page scrolling |

**API Stability Guarantee:**
These props will NOT change during Chakra UI migration. Consumers can safely use this API.

---

## Usage Examples

### Simple Confirmation Modal

```javascript
import { useState } from 'react';
import { Modal } from '../components/design-system';

function DeleteButton() {
  const [showModal, setShowModal] = useState(false);

  const handleDelete = () => {
    // Perform delete
    setShowModal(false);
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>Delete</button>

      <Modal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleDelete}
        title="Confirm Deletion"
        submitText="Delete"
        submitVariant="danger"
        size="sm"
      >
        Are you sure you want to delete this item?
      </Modal>
    </>
  );
}
```

### Form Modal with Custom Footer

```javascript
import { Modal } from '../components/design-system';

function EditProfileModal({ show, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(formData);
    setLoading(false);
    onClose();
  };

  const customFooter = (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
      <button onClick={onClose} disabled={loading}>
        Cancel
      </button>
      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Edit Profile"
      size="lg"
      footer={customFooter}
    >
      <form>
        {/* Form fields */}
      </form>
    </Modal>
  );
}
```

### Fullscreen Modal with Document Scroll

```javascript
import { Modal } from '../components/design-system';

function PlanItemDetailsModal({ show, onClose, planItem }) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Plan Item Details"
      size="fullscreen"
      allowBodyScroll={true}
      showHeader={true}
    >
      <Tabs>
        <Tab label="Notes">
          <PlanItemNotes planItem={planItem} />
        </Tab>
        <Tab label="Documents">
          <DocumentsList planItem={planItem} />
        </Tab>
        <Tab label="Chat">
          <ChatInterface planItem={planItem} />
        </Tab>
      </Tabs>
    </Modal>
  );
}
```

---

## Import Patterns

### ✅ CORRECT - Import from design-system

```javascript
import { Modal } from '../components/design-system';
```

**Why this is correct:**
- Decoupled from implementation
- Future-proof for Chakra migration
- Centralized import path

### ❌ INCORRECT - Direct import

```javascript
import Modal from '../Modal/Modal';
```

**Why this is wrong:**
- Tightly coupled to Bootstrap
- Will break during Chakra migration
- Must be updated manually

### Migration Path

**Before:**
```javascript
import Modal from '../../components/Modal/Modal';

function MyComponent() {
  return <Modal show={true} onClose={handleClose}>Content</Modal>;
}
```

**After:**
```javascript
import { Modal } from '../../components/design-system';

function MyComponent() {
  return <Modal show={true} onClose={handleClose}>Content</Modal>;
}
```

**Changes:**
- ✅ Import path changed
- ✅ Named import instead of default import
- ✅ Component usage IDENTICAL
- ✅ Props IDENTICAL
- ✅ Behavior IDENTICAL

---

## Testing

### Unit Tests

```javascript
import { render, screen } from '@testing-library/react';
import { Modal } from '../components/design-system';

describe('Modal Abstraction', () => {
  it('should render modal when show=true', () => {
    render(
      <Modal show={true} onClose={() => {}} title="Test">
        Content
      </Modal>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal show={true} onClose={onClose} title="Test">
        Content
      </Modal>
    );

    // Click close button
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

### E2E Tests

All existing E2E tests in `tests/e2e/modal-flows.test.js` should pass without modification after consumer migration.

---

## Implementation Details

### Current (Phase 1): Bootstrap Pass-Through

```javascript
// src/components/ModalWrapper/ModalWrapper.jsx
import BootstrapModal from '../Modal/Modal';

const ModalWrapper = forwardRef((props, ref) => {
  // Always use Bootstrap in Phase 1
  return <BootstrapModal {...props} ref={ref} />;
});
```

**Behavior:**
- ✅ Identical to direct Bootstrap Modal import
- ✅ Zero performance overhead (simple pass-through)
- ✅ Full backward compatibility

### Future (Phase 3): Chakra Implementation

```javascript
// src/components/ModalWrapper/ModalWrapper.jsx
import BootstrapModal from '../Modal/Modal';
import ChakraModalWrapper from './ChakraModalWrapper';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const ModalWrapper = forwardRef((props, ref) => {
  const useChakraModal = useFeatureFlag('chakra_modal');

  if (useChakraModal) {
    return <ChakraModalWrapper {...props} ref={ref} />;
  }

  return <BootstrapModal {...props} ref={ref} />;
});
```

**Behavior:**
- ✅ Feature-flagged transition
- ✅ Rollback capability
- ✅ A/B testing possible
- ✅ Gradual rollout

---

## Prop Mapping (Bootstrap → Chakra)

When implementing Chakra wrapper (Phase 3), props will be mapped as follows:

| Bootstrap Prop | Chakra Prop | Notes |
|----------------|-------------|-------|
| `show` | `open` | Renamed |
| `onClose` | `onClose` | Same |
| `size` | `size` | Map sm→sm, lg→lg, xl→xl, fullscreen→full |
| `centered` | `placement="center"` | Different prop name |
| `scrollable` | `scrollBehavior="inside"` | Different prop name |
| `title` | `DialogTitle` children | Component instead of prop |
| `children` | `DialogBody` children | Wrapped in component |
| `footer` | `DialogFooter` children | Wrapped in component |
| `showHeader` | Conditional `DialogHeader` | Component visibility |
| `icon` | Rendered before `DialogTitle` | Same pattern |
| `allowBodyScroll` | `blockScrollOnMount={false}` | Different prop name |

**CRITICAL:** All prop mappings must be documented and tested before rollout.

---

## Backward Compatibility

### Guaranteed

- ✅ All existing props continue to work
- ✅ All existing behavior preserved
- ✅ Zero breaking changes for consumers
- ✅ PropTypes validation identical

### Migration Contract

**Promise to Consumers:**
1. Import path changes once: `../Modal/Modal` → `design-system`
2. No prop changes required
3. No behavior changes
4. Full TypeScript/PropTypes support

**If we break this contract:**
- Rollback immediately
- Fix implementation
- Re-test all consumers

---

## Related Documentation

- [Modal Baseline Documentation](../../../docs/migration/modal-baseline-documentation.md)
- [E2E Test Suite](../../../tests/e2e/README.md)
- [Current Modal Implementation](../Modal/Modal.jsx)
- [Design System Index](../design-system.js)
- [Task: biensperience-012c](https://github.com/anthropics/beads) - Modal Abstraction
- [Task: biensperience-f9af](https://github.com/anthropics/beads) - Consumer Migration
- [Task: biensperience-277f](https://github.com/anthropics/beads) - Chakra Implementation

---

## Checklist

### Phase 1: Abstraction Layer ✅
- [x] Create ModalWrapper.jsx
- [x] Export from design-system.js
- [x] Document API thoroughly
- [x] Add PropTypes validation
- [x] Support ref forwarding

### Phase 2: Consumer Migration ⏳
- [ ] Update 64 modal consumers
- [ ] Run E2E tests after each migration
- [ ] Verify zero regressions
- [ ] Document any edge cases

### Phase 3: Chakra Implementation ⏳
- [ ] Create ChakraModalWrapper
- [ ] Map all Bootstrap props
- [ ] Replicate visual styling
- [ ] Pass 100% E2E tests
- [ ] Visual regression testing

### Phase 4: Rollout ⏳
- [ ] Enable feature flag by default
- [ ] Monitor for 1 week
- [ ] Fix any issues
- [ ] Remove Bootstrap code

---

**Version:** 1.0 (Phase 1 Complete)
**Last Updated:** 2026-01-24
**Maintained By:** AI Development Team
