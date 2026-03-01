# Modal Abstraction Layer

**Status:** Phase 4 Complete - Dialog Modal is default
**Task:** biensperience-012c

---

## Overview

The Modal abstraction layer provides a stable API for modal usage across the Biensperience application. It wraps the underlying modal implementation to enable seamless UI framework transitions without breaking consumer code.

**Default Implementation:** DialogModal (modern Dialog-based)
**Legacy Implementation:** Bootstrap Modal (available via `bootstrap_modal` feature flag)

---

## Why This Abstraction Exists

### Problem
Direct imports from `../Modal/Modal` create tight coupling:
```javascript
// BAD - Tightly coupled to specific implementation
import Modal from '../Modal/Modal';
```

### Solution
Import from design-system abstraction:
```javascript
// GOOD - Decoupled from implementation
import { Modal } from '../components/design-system';
```

When swapping implementations:
- Update 1 file (ModalWrapper.jsx)
- Zero changes to consumers
- Feature-flagged rollout

---

## Current Architecture

```
design-system.js
  └── ModalWrapper.jsx (abstraction layer)
        ├── DialogModal.jsx (default — modern Dialog implementation)
        └── Modal.jsx (legacy — Bootstrap portal, via 'bootstrap_modal' flag)
```

```javascript
// ModalWrapper.jsx
const ModalWrapper = forwardRef((props, ref) => {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_modal');
  const ModalComponent = useLegacy ? BootstrapModal : DialogModal;
  return <ModalComponent {...props} ref={ref} />;
});
```

---

## API Reference

### Props

All props are supported by both implementations:

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `show` | boolean | - | Yes | Controls modal visibility |
| `onClose` | function | - | Yes | Callback when modal closes |
| `onSubmit` | function | - | No | Callback for form submission |
| `title` | node | - | No | Modal title (supports JSX) |
| `children` | node | - | No | Modal body content |
| `submitText` | string | "Submit" | No | Submit button text |
| `submitVariant` | string | "primary" | No | Submit button variant |
| `cancelText` | string | "Cancel" | No | Cancel button text |
| `showCancelButton` | boolean | true | No | Show cancel button |
| `showSubmitButton` | boolean | true | No | Show submit button |
| `disableSubmit` | boolean | false | No | Disable submit button |
| `loading` | boolean | false | No | Show loading state |
| `size` | string | undefined | No | Modal size: 'sm', 'lg', 'xl', 'fullscreen' |
| `scrollable` | boolean | false | No | Enable body scrolling |
| `centered` | boolean | true | No | Center modal vertically |
| `footer` | node | - | No | Custom footer content |
| `dialogClassName` | string | "" | No | Custom class for dialog |
| `contentClassName` | string | "" | No | Custom class for content |
| `bodyClassName` | string | "" | No | Custom class for body |
| `icon` | node | - | No | Icon before title |
| `showHeader` | boolean | true | No | Show modal header |
| `allowBodyScroll` | boolean | false | No | Allow page scrolling |

**API Stability Guarantee:**
These props will NOT change during implementation swaps. Consumers can safely use this API.

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
      <button onClick={onClose} disabled={loading}>Cancel</button>
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
      <form>{/* Form fields */}</form>
    </Modal>
  );
}
```

---

## Import Patterns

### Correct - Import from design-system

```javascript
import { Modal } from '../components/design-system';
```

### Incorrect - Direct import

```javascript
import Modal from '../Modal/Modal';
```

---

## Implementation Files

- `ModalWrapper.jsx` - Abstraction layer with feature flag
- `../Modal/DialogModal.jsx` - Modern Dialog-based implementation (default)
- `../Modal/Modal.jsx` - Legacy Bootstrap portal implementation
- `../design-system.js` - Public export

---

## Related Documentation

- [Current Modal Implementation](../Modal/Modal.jsx)
- [Dialog Modal Implementation](../Modal/DialogModal.jsx)
- [Design System Index](../design-system.js)

---

**Version:** 2.0 (Phase 4 Complete)
**Last Updated:** 2026-02-28
