import Loading from './Loading';

export default {
  title: 'Components/Loading',
  component: Loading,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A highly customizable loading component with multiple animation variations. Supports 8 animation types, 4 size variants, and 3 display modes. Automatically respects user motion preferences for accessibility.',
      },
    },
  },
  tags: [],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size of the loading indicator',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'md' },
      },
    },
    animation: {
      control: 'select',
      options: ['pulse', 'spin', 'fan', 'orbit', 'breathe', 'bounce', 'shake', 'wave', 'engine'],
      description: 'Animation type to display',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'pulse' },
      },
    },
    variant: {
      control: 'select',
      options: ['inline', 'centered', 'fullscreen'],
      description: 'Display variant',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'inline' },
      },
    },
    overlay: {
      control: 'select',
      options: ['none', 'light', 'dark'],
      description: 'Overlay style for fullscreen variant',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'none' },
      },
    },
    message: {
      control: 'text',
      description: 'Loading message text',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'Loading...' },
      },
    },
    showMessage: {
      control: 'boolean',
      description: 'Whether to show the loading message',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: true },
      },
    },
  },
};

// Default story
export const Default = {
  args: {
    size: 'md',
    animation: 'pulse',
    variant: 'inline',
    message: 'Loading...',
    showMessage: true,
    overlay: 'none',
  },
};

// Animation variations
export const PulseAnimation = {
  args: {
    animation: 'pulse',
    size: 'lg',
    message: 'Loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Smooth pulsing scale animation - subtle and non-distracting. Best for general-purpose loading states.',
      },
    },
  },
};

export const SpinAnimation = {
  args: {
    animation: 'spin',
    size: 'lg',
    message: 'Processing...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Entire logo rotates continuously in a smooth circular motion. Best for continuous operations and synchronization.',
      },
    },
  },
};

export const FanAnimation = {
  args: {
    animation: 'fan',
    size: 'lg',
    message: 'Starting up...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Plus sign rotates like a starting fan - starts slow, speeds up progressively. Best for application startup and initialization.',
      },
    },
  },
};

export const OrbitAnimation = {
  args: {
    animation: 'orbit',
    size: 'xl',
    message: 'Syncing data...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Purple gradient trails orbit around the icon in a circular motion. Best for data synchronization and cloud operations.',
      },
    },
  },
};

export const BreatheAnimation = {
  args: {
    animation: 'breathe',
    size: 'md',
    message: 'Please wait...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Gentle breathing effect with scale and soft glow - calm and meditative. Best for calm waiting states.',
      },
    },
  },
};

export const BounceAnimation = {
  args: {
    animation: 'bounce',
    size: 'md',
    message: 'Getting ready...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Playful bouncing animation with realistic physics - energetic and engaging. Best for playful contexts and game loading.',
      },
    },
  },
};

export const ShakeAnimation = {
  args: {
    animation: 'shake',
    size: 'sm',
    message: 'Retrying...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Subtle shake for error or attention-grabbing states. Best for retry operations and alerts.',
      },
    },
  },
};

export const WaveAnimation = {
  args: {
    animation: 'wave',
    size: 'lg',
    message: 'Loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Smooth wave-like motion with rotation - fluid and organic. Best for fluid processes and smooth transitions.',
      },
    },
  },
};

export const EngineAnimation = {
  args: {
    animation: 'engine',
    size: 'lg',
    message: 'Preparing flight...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Plus icon morphs into airplane engine with spinning fan - transformation animation. Best for travel contexts and flight booking.',
      },
    },
  },
};

// Size variations
export const SmallSize = {
  args: {
    size: 'sm',
    animation: 'pulse',
    message: 'Small (32×32px)',
  },
  parameters: {
    docs: {
      description: {
        story: 'Small size (32×32px) - for inline text, buttons, and compact spaces.',
      },
    },
  },
};

export const MediumSize = {
  args: {
    size: 'md',
    animation: 'pulse',
    message: 'Medium (64×64px)',
  },
  parameters: {
    docs: {
      description: {
        story: 'Medium size (64×64px) - default size for cards and modals.',
      },
    },
  },
};

export const LargeSize = {
  args: {
    size: 'lg',
    animation: 'pulse',
    message: 'Large (96×96px)',
  },
  parameters: {
    docs: {
      description: {
        story: 'Large size (96×96px) - for large cards and page sections.',
      },
    },
  },
};

export const ExtraLargeSize = {
  args: {
    size: 'xl',
    animation: 'pulse',
    message: 'Extra Large (128×128px)',
  },
  parameters: {
    docs: {
      description: {
        story: 'Extra large size (128×128px) - for fullscreen overlays and splash screens.',
      },
    },
  },
};

// Display variants
export const InlineDisplay = {
  args: {
    variant: 'inline',
    size: 'md',
    message: 'Inline loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Inline display - respects parent container flow.',
      },
    },
  },
};

export const CenteredDisplay = {
  args: {
    variant: 'centered',
    size: 'lg',
    message: 'Centered loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Centered display - centered within container without overlay.',
      },
    },
  },
};

export const FullscreenWithLightOverlay = {
  args: {
    variant: 'fullscreen',
    overlay: 'light',
    size: 'xl',
    animation: 'orbit',
    message: 'Loading application...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Fullscreen display with light overlay - covers entire viewport.',
      },
    },
  },
};

export const FullscreenWithDarkOverlay = {
  args: {
    variant: 'fullscreen',
    overlay: 'dark',
    size: 'xl',
    animation: 'breathe',
    message: 'Processing...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Fullscreen display with dark overlay - for better focus on loading state.',
      },
    },
  },
};

// Without message
export const NoMessage = {
  args: {
    size: 'md',
    animation: 'spin',
    showMessage: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading indicator without message text.',
      },
    },
  },
};

// All animations showcase
export const AllAnimations = {
  args: {
    size: "md"
  },
  render:() => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="pulse" size="lg" message="Pulse" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="spin" size="lg" message="Spin" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="fan" size="lg" message="Fan" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="orbit" size="lg" message="Orbit" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="breathe" size="lg" message="Breathe" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="bounce" size="lg" message="Bounce" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="shake" size="lg" message="Shake" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="wave" size="lg" message="Wave" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <Loading animation="engine" size="lg" message="Engine" />
      </div>
    </div>
  ),
  parameters:{
    docs: {
      description: {
        story: 'Showcase of all 9 animation types available.',
      },
    },
  }
};

// Interactive playground for testing all loading props
export const Playground = (args) => <Loading {...args} />;
Playground.args = {
  size: 'md',
  variant: 'inline',
  animation: 'pulse',
  message: 'Loading...',
  showMessage: true,
  overlay: 'none'
};
