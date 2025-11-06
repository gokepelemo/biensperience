export default {
  title: 'Introduction',
  parameters: {
    options: { showPanel: false }
  }
};

export const Overview = {
  render: () => (
    <div style={{ maxWidth: 880 }}>
      <h1>Biensperience Storybook</h1>
      <p>
        Welcome to the Biensperience component library. This Storybook showcases our design system
        and core UI components with live examples, controls, and documentation.
      </p>
      <h2>What you'll find</h2>
      <ul>
        <li>Design System: Tokens, spacing, colors, typography, and reusable utilities.</li>
        <li>Components: Core building blocks like Alert, Modal, Loading, and more.</li>
        <li>Theming: Toggle light/dark themes from the toolbar.</li>
        <li>Viewports: Preview on mobile, tablet, and desktop.</li>
      </ul>
      <h2>Conventions</h2>
      <ul>
        <li>Use design tokens for pixel-perfect consistency.</li>
        <li>Expose accessible labels/aria attributes.</li>
        <li>Avoid layout shifts (no jitter) by reserving space and using placeholders.</li>
      </ul>
      <p style={{ marginTop: '1rem', fontStyle: 'italic', color: '#6c757d' }}>
        Storybook auto-loads our app CSS (bootstrap + theme + tokens) to ensure accuracy.
      </p>
    </div>
  )
};


