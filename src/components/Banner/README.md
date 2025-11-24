# Banner Component

A reusable banner component for notifications and alerts with auto-expiry functionality, configurable buttons, icons, and full dark mode support.

## Features

- **Auto-expiry**: Banners can automatically disappear after a set time with smooth easing animation
- **Configurable Buttons**: Add action buttons with custom text, variants, and click handlers
- **Custom Icons**: Use emoji, React icons, or any custom icon component
- **Multiple Variants**: Light, solid, and bordered visual styles
- **Semantic Types**: Info, success, warning, danger, and neutral types
- **Dark Mode Compatible**: Automatically adapts to dark mode preferences
- **Responsive Design**: Mobile-first responsive design
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Dismissible**: Optional manual dismissal with close button

## Basic Usage

```jsx
import { Banner } from '../components/design-system';

function MyComponent() {
  return (
    <Banner
      type="info"
      title="Welcome!"
      message="This is an informational banner."
    />
  );
}
```

## Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'info' \| 'success' \| 'warning' \| 'danger' \| 'neutral'` | `'info'` | Semantic type affecting colors and default icon |
| `variant` | `'light' \| 'solid' \| 'bordered'` | `'light'` | Visual style variant |
| `title` | `string` | - | Banner title text |
| `message` | `string` | - | Banner subtitle/message text |
| `icon` | `ReactNode` | - | Custom icon component (defaults to type-based emoji) |
| `showIcon` | `boolean` | `true` | Whether to show the icon |
| `dismissible` | `boolean` | `false` | Whether banner can be manually dismissed |
| `onDismiss` | `function` | - | Callback when banner is manually dismissed |
| `onExpiry` | `function` | - | Callback when banner expires automatically |
| `expiryTime` | `number` | `0` | Auto-expiry time in milliseconds (0 = no expiry) |
| `button` | `object` | - | Button configuration object |
| `button.text` | `string` | - | Button text (required if button provided) |
| `button.variant` | `string` | - | Button variant (passed to Button component) |
| `button.onClick` | `function` | - | Button click handler |
| `button.disabled` | `boolean` | - | Whether button is disabled |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Banner size affecting padding and font sizes |
| `className` | `string` | - | Additional CSS classes |
| `style` | `object` | - | Inline styles |
| `children` | `ReactNode` | - | Custom content (replaces title/message) |

## Examples

### Basic Types

```jsx
// Info banner
<Banner type="info" title="Information" message="This is an info message." />

// Success banner
<Banner type="success" title="Success!" message="Operation completed successfully." />

// Warning banner
<Banner type="warning" title="Warning" message="Please review this information." />

// Error banner
<Banner type="danger" title="Error" message="Something went wrong." />

// Neutral banner
<Banner type="neutral" title="Notice" message="General notification." />
```

### Variants

```jsx
// Light variant (default)
<Banner type="success" variant="light" title="Light Banner" />

// Solid variant
<Banner type="success" variant="solid" title="Solid Banner" />

// Bordered variant
<Banner type="success" variant="bordered" title="Bordered Banner" />
```

### With Buttons

```jsx
<Banner
  type="success"
  title="Welcome Back!"
  message="Your profile has been updated."
  button={{
    text: 'View Profile',
    variant: 'outline',
    onClick: () => navigate('/profile')
  }}
/>
```

### Auto-expiry

```jsx
<Banner
  type="info"
  title="Temporary Notice"
  message="This banner will disappear in 5 seconds."
  expiryTime={5000}
  onExpiry={() => console.log('Banner expired')}
/>
```

### Dismissible

```jsx
<Banner
  type="warning"
  title="Dismissible Banner"
  message="Click the X to dismiss this banner."
  dismissible
  onDismiss={() => console.log('Banner dismissed')}
/>
```

### Custom Icons

```jsx
import { FaRocket, FaHeart } from 'react-icons/fa';

// With React icon
<Banner
  type="success"
  title="Achievement!"
  message="You've unlocked a new feature."
  icon={<FaRocket size={20} />}
/>

// With emoji
<Banner
  type="neutral"
  title="Thank You"
  message="We appreciate your support."
  icon="❤️"
/>
```

### Complex Example

```jsx
<Banner
  type="success"
  variant="solid"
  size="lg"
  title="🎉 Welcome to Premium!"
  message="Your subscription is now active with unlimited access."
  icon={<FaRocket size={24} />}
  dismissible
  expiryTime={10000}
  onDismiss={() => setShowBanner(false)}
  onExpiry={() => setShowBanner(false)}
  button={{
    text: 'Explore Features',
    variant: 'outline',
    onClick: () => navigate('/premium')
  }}
/>
```

## Styling

The Banner component uses CSS Modules with SCSS and follows the design system conventions:

- **Colors**: Uses CSS custom properties for theming
- **Dark Mode**: Automatically adapts using `prefers-color-scheme`
- **Responsive**: Mobile-first design with breakpoints
- **Animations**: Smooth transitions and expiry animations

## Design System Integration

The Banner component is fully integrated with the Biensperience design system:

- Uses design system color tokens
- Follows spacing and typography scales
- Supports all design system button variants
- Compatible with dark mode theming
- Uses CSS custom properties for customization

## Accessibility

- **ARIA**: Includes `role="alert"` and `aria-live="polite"`
- **Keyboard**: Close button is keyboard accessible
- **Screen Readers**: Proper labeling and semantic structure
- **Focus Management**: Close button receives focus appropriately
- **Color Contrast**: All variants meet WCAG contrast requirements

## Migration from Storybook Banners

If you're migrating from the existing Storybook banner component:

```jsx
// Old Storybook banner
<Banner
  type="info"
  title="Title"
  subtitle="Message"
  hasButton
  buttonText="Click me"
  onClose={() => {}}
/>

// New design system banner
<Banner
  type="info"
  title="Title"
  message="Message"
  button={{
    text: 'Click me',
    onClick: () => {}
  }}
  dismissible
  onDismiss={() => {}}
/>
```

Key differences:
- `subtitle` → `message`
- `hasButton` + `buttonText` → `button` object
- `onClose` → `onDismiss`
- Added `dismissible` prop
- Added `expiryTime` for auto-expiry
- Enhanced icon and styling options