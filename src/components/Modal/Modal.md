# Modal Component

A reusable, flexible modal component that accepts custom content as children.

## Features

- Customizable title, buttons, and content
- Optional submit and cancel buttons
- Loading state support
- Multiple size options (sm, lg, xl)
- Scrollable body option
- Custom footer support
- Portal rendering for proper z-index handling
- Responsive design

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `show` | boolean | Yes | - | Whether to display the modal |
| `onClose` | function | Yes | - | Callback when modal is closed/cancelled |
| `title` | string | Yes | - | Modal header title |
| `children` | ReactNode | Yes | - | Content to render in modal body |
| `onSubmit` | function | No | - | Callback when submit button is clicked |
| `submitText` | string | No | "Submit" | Text for submit button |
| `submitVariant` | string | No | "primary" | Bootstrap variant for submit button |
| `cancelText` | string | No | "Cancel" | Text for cancel button |
| `showCancelButton` | boolean | No | true | Whether to show cancel button |
| `showSubmitButton` | boolean | No | true | Whether to show submit button (when onSubmit provided) |
| `disableSubmit` | boolean | No | false | Whether to disable submit button |
| `loading` | boolean | No | false | Whether modal is in loading state |
| `size` | string | No | - | Modal size: 'sm', 'lg', 'xl' |
| `scrollable` | boolean | No | false | Whether modal body is scrollable |
| `centered` | boolean | No | true | Whether modal is vertically centered |
| `footer` | ReactNode | No | - | Custom footer content (overrides default buttons) |

## Usage Examples

### Basic Modal with Form

```jsx
import Modal from '../../components/Modal/Modal';
import { useState } from 'react';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = () => {
    console.log('Submitted:', formData);
    setShowModal(false);
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>Open Modal</button>
      
      <Modal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        title="Edit Profile"
        submitText="Save Changes"
      >
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input
            type="text"
            className="form-control"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>
      </Modal>
    </>
  );
}
```

### Modal with Loading State

```jsx
<Modal
  show={showModal}
  onClose={() => setShowModal(false)}
  onSubmit={handleSubmit}
  title="Processing"
  submitText="Confirm"
  loading={isLoading}
  disableSubmit={!isValid}
>
  <p>Please confirm your action.</p>
</Modal>
```

### Large Scrollable Modal

```jsx
<Modal
  show={showModal}
  onClose={() => setShowModal(false)}
  title="Terms and Conditions"
  size="lg"
  scrollable={true}
  showSubmitButton={false}
  cancelText="Close"
>
  <div>
    <h4>Section 1</h4>
    <p>Long content here...</p>
    <h4>Section 2</h4>
    <p>More content...</p>
    {/* ... */}
  </div>
</Modal>
```

### Modal with Custom Footer

```jsx
<Modal
  show={showModal}
  onClose={() => setShowModal(false)}
  title="Custom Actions"
  footer={
    <div className="d-flex justify-content-between w-100">
      <button className="btn btn-warning" onClick={handleOption1}>
        Option 1
      </button>
      <button className="btn btn-info" onClick={handleOption2}>
        Option 2
      </button>
      <button className="btn btn-success" onClick={handleOption3}>
        Option 3
      </button>
    </div>
  }
>
  <p>Choose one of the options below.</p>
</Modal>
```

### Information Modal (No Submit)

```jsx
<Modal
  show={showModal}
  onClose={() => setShowModal(false)}
  title="Information"
  showSubmitButton={false}
  cancelText="Got it"
>
  <p>This is an informational message.</p>
  <ul>
    <li>Point 1</li>
    <li>Point 2</li>
    <li>Point 3</li>
  </ul>
</Modal>
```

### Danger Action Modal

```jsx
<Modal
  show={showModal}
  onClose={() => setShowModal(false)}
  onSubmit={handleDelete}
  title="Confirm Delete"
  submitText="Delete"
  submitVariant="danger"
>
  <p>Are you sure you want to delete this item?</p>
  <p className="text-danger">This action cannot be undone.</p>
</Modal>
```

## Styling

The Modal component uses Bootstrap classes and custom CSS. The modal is rendered at the document body level using React portals to ensure proper z-index layering.

### Custom Styling

You can add custom classes to the content by wrapping it:

```jsx
<Modal {...props}>
  <div className="my-custom-modal-content">
    {/* Your content */}
  </div>
</Modal>
```

## Accessibility

- Uses semantic HTML with proper ARIA labels
- Close button includes `aria-label="Close"`
- Proper focus management
- Keyboard accessible (ESC key support can be added via onClose)

## Notes

- The modal backdrop prevents interaction with content behind it
- Modal is centered by default but can be adjusted via `centered` prop
- Loading state disables both close and submit buttons
- Modal renders via React portal for proper z-index stacking
