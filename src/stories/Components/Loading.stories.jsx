import Loading from '../../components/Loading/Loading';

export default {
  title: 'Components/Loading',
  component: Loading,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Minimal loading indicator with subtle animations to prevent UI jitter. Prefer inline usage with short, unobtrusive text. Supports centered and fullscreen overlays when needed.',
      },
    },
  },
  args: {
    size: 'md',
    variant: 'inline',
    animation: 'pulse',
    message: 'Loading...'
  },
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'] },
    variant: { control: { type: 'select' }, options: ['inline', 'centered', 'fullscreen'] },
    animation: { control: { type: 'select' }, options: ['pulse', 'spin', 'fan', 'orbit', 'breathe', 'bounce', 'engine'] },
    overlay: { control: { type: 'select' }, options: ['none', 'light', 'dark'] },
    showMessage: { control: 'boolean' },
    allowCustomMessage: { control: 'boolean' }
  }
};

export const Pulse = {
  args: { animation: 'pulse', variant: 'centered', size: 'md' }
};

export const Engine = {
  args: { animation: 'engine', variant: 'centered', size: 'lg', message: 'Preparing flight...', allowCustomMessage: true }
};

export const FullscreenOverlay = {
  args: { animation: 'orbit', variant: 'fullscreen', overlay: 'light', size: 'lg', showMessage: true }
};

export const UsageNotes = {
  parameters: {
    docs: {
      description: {
        story:
          'Use inline loading for short actions to keep layouts stable. For blocking actions, prefer the fullscreen overlay variant with a light or dark scrim. Keep messages short to avoid layout shifts.',
      },
    },
  },
  render: () => (
    <div style={{ maxWidth: 620 }}>
      <h4 style={{ marginBottom: 12 }}>Guidelines</h4>
      <ul>
        <li>Reserve space to prevent content jumping during load.</li>
        <li>Use center or fullscreen variants only for blocking flows.</li>
        <li>Prefer pulse animation to keep visual noise low.</li>
        <li>Keep messages optional and concise.</li>
      </ul>
    </div>
  ),
};
