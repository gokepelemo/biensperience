# Loading Component

A highly customizable loading component with multiple animation variations for the Biensperience platform.

## Features

- 🎨 **8 Animation Types**: pulse, spin, fan, orbit, breathe, bounce, shake, wave
- 📏 **4 Size Variants**: sm (32px), md (64px), lg (96px), xl (128px)
- 🎭 **3 Display Variants**: inline, centered, fullscreen
- 🌓 **Dark Mode Support**: Automatically adapts to user's color scheme preference
- ♿ **Accessibility**: Respects `prefers-reduced-motion`, includes ARIA labels
- 🎯 **Performance**: Optimized animations with `will-change` hints

## Animation Types

### Pulse (Default)
Smooth pulsing scale animation - subtle and non-distracting.
```jsx
<Loading animation="pulse" size="md" message="Loading..." />
```
**Best for**: General-purpose loading states, default fallback

### Spin
Entire logo rotates continuously in a smooth circular motion.
```jsx
<Loading animation="spin" size="lg" message="Processing..." />
```
**Best for**: Continuous operations, background tasks, synchronization

### Fan
Plus sign rotates like a starting fan - starts slow, speeds up progressively.
```jsx
<Loading animation="fan" size="lg" message="Starting up..." />
```
**Best for**: Application startup, initialization, system boot sequences

### Orbit
Purple gradient trails orbit around the icon in a circular motion.
```jsx
<Loading animation="orbit" size="xl" message="Syncing data..." />
```
**Best for**: Data synchronization, circular processes, cloud operations

### Breathe
Gentle breathing effect with scale and soft glow - calm and meditative.
```jsx
<Loading animation="breathe" size="md" message="Please wait..." />
```
**Best for**: Calm waiting states, meditation apps, peaceful contexts

### Bounce
Playful bouncing animation with realistic physics - energetic and engaging.
```jsx
<Loading animation="bounce" size="md" message="Getting ready..." />
```
**Best for**: Playful contexts, game loading, user engagement scenarios

### Shake
Subtle shake for error or attention-grabbing states.
```jsx
<Loading animation="shake" size="sm" message="Retrying..." />
```
**Best for**: Error states, retry operations, attention-grabbing alerts

### Wave
Smooth wave-like motion with rotation - fluid and organic.
```jsx
<Loading animation="wave" size="lg" message="Loading..." />
```
**Best for**: Fluid processes, smooth transitions, natural motion contexts

### Engine
Plus icon morphing into airplane engine with spinning fan - transformation animation.
```jsx
<Loading animation="engine" size="lg" message="Preparing flight..." />
```
**Best for**: Travel contexts, flight booking, departure preparations, transformation processes

## Size Variants

| Size | Dimensions | Use Case |
|------|------------|----------|
| `sm` | 32×32px | Inline text, buttons, compact spaces |
| `md` | 64×64px | Default size, cards, modals |
| `lg` | 96×96px | Large cards, page sections |
| `xl` | 128×128px | Fullscreen overlays, splash screens |

## Display Variants

### Inline (Default)
Displays inline within content flow, respects parent container.
```jsx
<Loading variant="inline" size="md" message="Loading..." />
```

### Centered
Centers within parent container with minimum height.
```jsx
<Loading variant="centered" size="lg" message="Loading..." />
```

### Fullscreen
Fixed position overlay covering entire viewport.
```jsx
<Loading variant="fullscreen" size="xl" overlay="light" message="Loading..." />
```

## Overlay Options

Use with `variant="fullscreen"` for backdrop effects:

```jsx
// Light overlay (default for fullscreen)
<Loading variant="fullscreen" overlay="light" />

// Dark overlay
<Loading variant="fullscreen" overlay="dark" />

// No overlay (just the loader)
<Loading variant="fullscreen" overlay="none" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `animation` | string | `"pulse"` | Animation type: `pulse`, `spin`, `fan`, `orbit`, `breathe`, `bounce`, `shake`, `wave`, `engine` |
| `size` | string | `"md"` | Size variant: `sm`, `md`, `lg`, `xl` |
| `variant` | string | `"inline"` | Display variant: `inline`, `centered`, `fullscreen` |
| `message` | string | `"Loading..."` | Loading message text |
| `showMessage` | boolean | `true` | Whether to display the message |
| `overlay` | string | `"none"` | Overlay style: `none`, `light`, `dark` |
| `className` | string | `""` | Additional CSS classes |

## Usage Examples

### Basic Usage
```jsx
import Loading from "../../components/Loading/Loading";

function MyComponent() {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return <Loading />;
  }
  
  return <div>Content</div>;
}
```

### Inline Loading in Cards
```jsx
<div className="card">
  <div className="card-body">
    {loading ? (
      <Loading 
        animation="breathe" 
        size="sm" 
        message="Loading data..." 
      />
    ) : (
      <CardContent />
    )}
  </div>
</div>
```

### Fullscreen Overlay
```jsx
function App() {
  const [globalLoading, setGlobalLoading] = useState(false);
  
  return (
    <>
      <Navigation />
      <MainContent />
      
      {globalLoading && (
        <Loading
          variant="fullscreen"
          animation="orbit"
          size="xl"
          overlay="light"
          message="Syncing your data..."
        />
      )}
    </>
  );
}
```

### Dynamic Animation Based on Context
```jsx
function ContextualLoading({ loadingType }) {
  const animationMap = {
    saving: "spin",
    starting: "fan",
    syncing: "orbit",
    processing: "breathe",
    error: "shake"
  };
  
  return (
    <Loading 
      animation={animationMap[loadingType] || "pulse"}
      message={`${loadingType}...`}
    />
  );
}
```

## Accessibility

The Loading component is built with accessibility in mind:

### Reduced Motion
Respects user's `prefers-reduced-motion` setting:
- Animations are disabled for users who prefer reduced motion
- Static fade effect used instead
- Orbit trail becomes static circle
- Engine morphing animation is disabled

### Screen Readers
- SVG includes proper `role="img"` and `aria-label`
- Loading messages are announced to screen readers
- Semantic HTML structure

### High Contrast Mode
- Enhanced shadows for better visibility
- Increased font weight for messages
- Maintains readability in high contrast settings

## Performance Optimization

- Uses `will-change` CSS property for smooth animations
- Hardware-accelerated transforms (translate, rotate, scale)
- Lazy loading support via React.lazy()
- Optimized SVG with minimal DOM elements
- Efficient CSS animations with minimal repaints

## Animation Implementation Details

### Fan Animation
The fan animation simulates a starting fan blade with progressive acceleration:
- Rotates from 0° to 1080° (3 full rotations)
- Uses ease-in-out timing for natural acceleration/deceleration
- Duration: 3 seconds per cycle
- The plus sign element rotates independently from the background

### Engine Animation
The engine animation creates a morphing transformation effect:
- **Phase 1 (0-25%)**: Plus icon visible at full opacity
- **Transition (25-35%)**: Plus fades out and scales down (0.6x)
- **Phase 2 (35-85%)**: Engine visible with spinning fan
- **Transition (85-100%)**: Engine fades out, plus fades back in
- **Fan**: Continuously spins at 0.7s per rotation throughout engine phase
- Duration: 6 seconds per complete cycle
- Transform origin: Center of the icon (128px, 128px)

### Orbit Animation
Creates a trailing gradient effect that orbits the icon:
- Uses SVG `animateTransform` for smooth circular motion
- Purple gradient trail with fade-in/fade-out effect
- Synchronized with subtle pulsing of the main logo
- Duration: 2 seconds per orbit

### Technical Details
All animations use:
- CSS `transform` properties for GPU acceleration
- `will-change` hints for optimization
- Minimal repaints and reflows
- Efficient keyframe definitions

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Migration from Old Loading Component

If upgrading from the previous version:

```jsx
// Old (still works)
<Loading size="md" />

// New with animations
<Loading animation="spin" size="md" />

// All props are backward compatible
<Loading 
  variant="fullscreen" 
  size="lg" 
  message="Loading..."
/>
```

## Contributing

When adding new animations:

1. Add animation CSS to `Loading.css`
2. Add animation name to component prop types documentation
3. Test with `prefers-reduced-motion`
4. Verify dark mode appearance
5. Update this README with usage examples

## Related Components

- **ErrorBoundary**: For error states
- **Alert**: For notification messages
- **Modal**: For dialog loading states

## License

Part of the Biensperience platform. See main LICENSE file for details.
