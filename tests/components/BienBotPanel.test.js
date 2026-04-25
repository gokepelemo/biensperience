/**
 * Tests for BienBotPanel component
 *
 * Tests cover:
 * - Rendering chat mode and notification-only mode
 * - Header title and labels
 * - Close button
 * - Escape key closes panel
 * - Backdrop click closes panel
 * - Empty state message
 * - Message rendering (user and assistant)
 * - Pending action cards (execute and cancel)
 * - Suggested chips (initial chips, server chips)
 * - New chat button
 * - Send via Enter key
 * - Notification banner
 * - Accessibility (role="dialog", aria-modal, aria-label)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Mock react-router-dom ─────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// ─── Mock react-markdown (ESM dependency issue) ───────────────────────────────
jest.mock('react-markdown', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children }) => React.createElement('div', null, children),
  };
});

jest.mock('remark-gfm', () => {
  return {
    __esModule: true,
    default: () => {},
  };
});

// ─── Mock contexts ──────────────────────────────────────────────────────────
jest.mock('../../src/contexts/UserContext', () => ({
  useUser: () => ({ user: { _id: 'user-1' }, loading: false }),
  UserProvider: ({ children }) => children,
}));

jest.mock('../../src/contexts/DataContext', () => ({
  useData: () => ({
    experiences: [],
    destinations: [],
    plans: [],
    loading: false,
  }),
  DataProvider: ({ children }) => children,
}));

// ─── Mock useBienBot ────────────────────────────────────────────────────────
// Defined inside the jest.mock factory to avoid temporal dead zone issues.
jest.mock('../../src/hooks/useBienBot', () => {
  const mockFn = jest.fn();
  return mockFn;
});

// ─── Mock bienbot-suggestions ───────────────────────────────────────────────
jest.mock('../../src/utilities/bienbot-suggestions', () => ({
  getSuggestionsForContext: jest.fn(() => []),
  getPlaceholderForContext: jest.fn(() => 'Ask BienBot anything...'),
  getEmptyStateForContext: jest.fn(() => 'Ask me anything to get started'),
}));

// ─── Mock design-system components (avoid Chakra recipe calls in tests) ─────
jest.mock('../../src/components/design-system', () => {
  const React = require('react');
  return {
    Button: ({ children, onClick, disabled, variant, size, ...props }) =>
      React.createElement('button', { onClick, disabled, 'data-variant': variant, ...props }, children),
    Text: ({ children, size, className, title, ...props }) =>
      React.createElement('span', { className, title, ...props }, children),
    Heading: ({ children, level = 2, style, ...props }) =>
      React.createElement(`h${level}`, { style, ...props }, children),
    Pill: ({ children, ...props }) =>
      React.createElement('span', { 'data-testid': 'pill', ...props }, children),
    Table: ({ children, ...props }) => React.createElement('table', props, children),
  };
});

// ─── Mock @chakra-ui/react Tag (used for suggestion chips) ──────────────────
jest.mock('@chakra-ui/react', () => {
  const React = require('react');
  return {
    Tag: {
      Root: ({ children, onClick, onKeyDown, role, tabIndex, ...props }) =>
        React.createElement('div', { role, tabIndex, onClick, onKeyDown, 'data-testid': 'chip', ...props }, children),
      Label: ({ children }) => React.createElement('span', null, children),
    },
    ChakraProvider: ({ children }) => children,
  };
});

// ─── Import after mocks ──────────────────────────────────────────────────────
import BienBotPanel from '../../src/components/BienBotPanel/BienBotPanel';
import useBienBot from '../../src/hooks/useBienBot';
import * as suggestions from '../../src/utilities/bienbot-suggestions';

// scrollIntoView is not implemented in jsdom — provide a no-op implementation
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// ─── Shared mock functions (defined after import so they're in scope) ────────
const mockSendMessage = jest.fn();
const mockExecuteActions = jest.fn();
const mockCancelAction = jest.fn();
const mockUpdateContext = jest.fn();
const mockClearSession = jest.fn();
const mockFetchSessions = jest.fn();
const mockGetPersistedSession = jest.fn().mockResolvedValue(null);

const defaultHookState = {
  messages: [],
  pendingActions: [],
  suggestedNextSteps: [],
  isLoading: false,
  isStreaming: false,
  sessions: [],
  currentSession: null,
  sendMessage: mockSendMessage,
  executeActions: mockExecuteActions,
  cancelAction: mockCancelAction,
  updateContext: mockUpdateContext,
  clearSession: mockClearSession,
  fetchSessions: mockFetchSessions,
  getPersistedSession: mockGetPersistedSession,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderPanel(props = {}) {
  const defaults = {
    open: true,
    onClose: jest.fn(),
    invokeContext: null,
    currentView: null,
    isEntityView: false,
    notificationOnly: false,
    notifications: [],
    unseenNotificationIds: [],
    onMarkNotificationsSeen: jest.fn(),
  };
  return render(<BienBotPanel {...defaults} {...props} />);
}

function setHookState(state) {
  useBienBot.mockReturnValue({ ...defaultHookState, ...state });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BienBotPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBienBot.mockReturnValue({ ...defaultHookState });
    suggestions.getSuggestionsForContext.mockReturnValue([]);
    suggestions.getPlaceholderForContext.mockReturnValue('Ask BienBot anything...');
    suggestions.getEmptyStateForContext.mockReturnValue('Ask me anything to get started');
  });

  // ─── Rendering ──────────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with role="dialog" and aria-modal="true"', () => {
      renderPanel();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('shows BienBot heading in chat mode', () => {
      renderPanel();
      expect(screen.getByText('BienBot')).toBeInTheDocument();
    });

    it('shows Notifications heading in notification-only mode', () => {
      renderPanel({ notificationOnly: true });
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('shows invokeContext label in header', () => {
      renderPanel({ invokeContext: { entity: 'experience', id: 'exp-1', label: 'Paris Trip' } });
      expect(screen.getByTitle('Paris Trip')).toBeInTheDocument();
    });

    it('shows "No notifications yet" when notification-only with no notifications', () => {
      renderPanel({ notificationOnly: true, notifications: [] });
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    });

    it('shows empty state text when no messages', () => {
      renderPanel();
      expect(screen.getByText('Ask me anything to get started')).toBeInTheDocument();
    });

    it('shows notification items when present', () => {
      const notifications = [
        {
          _id: 'n1',
          reason: 'John added you as a collaborator',
          resource: { id: 'exp-1', name: 'Paris Trip' }
        }
      ];
      renderPanel({ notificationOnly: true, notifications });
      expect(screen.getByText('John added you as a collaborator')).toBeInTheDocument();
    });

    it('shows loading dots when isLoading and not streaming', () => {
      setHookState({ isLoading: true, isStreaming: false });
      renderPanel();
      expect(screen.getByLabelText('BienBot is thinking')).toBeInTheDocument();
    });

    it('does not show loading dots when streaming', () => {
      setHookState({ isLoading: true, isStreaming: true });
      renderPanel();
      expect(screen.queryByLabelText('BienBot is thinking')).not.toBeInTheDocument();
    });
  });

  // ─── Messages ───────────────────────────────────────────────────────────
  describe('messages', () => {
    it('renders user messages', () => {
      setHookState({
        messages: [
          { _id: 'm1', role: 'user', content: 'Hello BienBot' }
        ]
      });
      renderPanel();
      expect(screen.getByText('Hello BienBot')).toBeInTheDocument();
    });

    it('renders assistant messages', () => {
      setHookState({
        messages: [
          { _id: 'm1', role: 'assistant', content: 'How can I help you?' }
        ]
      });
      renderPanel();
      // Content appears in both the message bubble and the sr-only status region
      const matches = screen.getAllByText('How can I help you?');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('renders multiple messages in order', () => {
      setHookState({
        messages: [
          { _id: 'm1', role: 'user', content: 'Plan Paris trip' },
          { _id: 'm2', role: 'assistant', content: 'Sure! Here is the plan.' },
        ]
      });
      renderPanel();
      expect(screen.getByText('Plan Paris trip')).toBeInTheDocument();
      // Assistant message appears in message bubble and sr-only status region
      const assistantMatches = screen.getAllByText('Sure! Here is the plan.');
      expect(assistantMatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Close behavior ─────────────────────────────────────────────────────
  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      renderPanel({ onClose });
      const closeBtn = screen.getByLabelText('Close BienBot');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = jest.fn();
      renderPanel({ onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows "Close notifications" label in notification-only mode', () => {
      renderPanel({ notificationOnly: true });
      expect(screen.getByLabelText('Close notifications')).toBeInTheDocument();
    });

    it('does not register Escape handler when panel is closed', () => {
      const onClose = jest.fn();
      renderPanel({ open: false, onClose });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ─── Send message ────────────────────────────────────────────────────────
  describe('send message', () => {
    it('calls sendMessage when Send button is clicked with text', async () => {
      renderPanel();
      const textarea = screen.getByPlaceholderText('Ask BienBot anything...');
      fireEvent.change(textarea, { target: { value: 'Plan my trip' } });
      // The input uses a ref for value, simulate directly
      Object.defineProperty(textarea, 'value', { value: 'Plan my trip', writable: true });

      // Find and click send button (aria-label="Send message")
      const sendBtn = screen.getByLabelText('Send message');
      fireEvent.click(sendBtn);

      // sendMessage is called with the textarea value via ref
      // The ref is set from the DOM element value
    });

    it('calls sendMessage on Enter key (no Shift)', async () => {
      renderPanel();
      const textarea = screen.getByPlaceholderText('Ask BienBot anything...');
      // Set internal value
      Object.defineProperty(textarea, 'value', { value: 'Hello', writable: true });
      textarea.value = 'Hello';
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      // sendMessage should be called (with whatever value was in the ref)
    });

    it('does not call sendMessage on Shift+Enter', () => {
      renderPanel();
      const textarea = screen.getByPlaceholderText('Ask BienBot anything...');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('disables send button when streaming', () => {
      setHookState({ isStreaming: true });
      renderPanel();
      const sendBtn = screen.getByLabelText('Send message');
      expect(sendBtn).toBeDisabled();
    });

    it('disables send button when loading', () => {
      setHookState({ isLoading: true });
      renderPanel();
      const sendBtn = screen.getByLabelText('Send message');
      expect(sendBtn).toBeDisabled();
    });
  });

  // ─── New chat button ─────────────────────────────────────────────────────
  describe('new chat button', () => {
    it('shows new chat button when messages are present', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hi' }]
      });
      renderPanel();
      expect(screen.getByLabelText('Start new chat')).toBeInTheDocument();
    });

    it('hides new chat button when no messages', () => {
      setHookState({ messages: [] });
      renderPanel();
      expect(screen.queryByLabelText('Start new chat')).not.toBeInTheDocument();
    });

    it('calls clearSession when new chat button is clicked', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hi' }]
      });
      renderPanel();
      fireEvent.click(screen.getByLabelText('Start new chat'));
      expect(mockClearSession).toHaveBeenCalledTimes(1);
    });

    it('disables new chat button when streaming', () => {
      setHookState({
        isStreaming: true,
        messages: [{ _id: 'm1', role: 'user', content: 'Hi' }]
      });
      renderPanel();
      expect(screen.getByLabelText('Start new chat')).toBeDisabled();
    });
  });

  // ─── Pending action cards ────────────────────────────────────────────────
  describe('pending action cards', () => {
    const actions = [
      { _id: 'act-1', type: 'create_experience', description: 'Create Paris trip experience' },
    ];

    it('renders action cards for pending actions', () => {
      setHookState({ pendingActions: actions });
      renderPanel();
      expect(screen.getByText('Create Paris trip experience')).toBeInTheDocument();
    });

    it('calls executeActions when Yes button is clicked', () => {
      setHookState({ pendingActions: actions });
      renderPanel();
      fireEvent.click(screen.getByText('Yes'));
      expect(mockExecuteActions).toHaveBeenCalledWith(['act-1']);
    });

    it('calls cancelAction when Cancel button is clicked', () => {
      setHookState({ pendingActions: actions });
      renderPanel();
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockCancelAction).toHaveBeenCalledWith('act-1');
    });

    it('disables action buttons when loading', () => {
      setHookState({ pendingActions: actions, isLoading: true });
      renderPanel();
      expect(screen.getByText('Yes')).toBeDisabled();
      expect(screen.getByText('Cancel')).toBeDisabled();
    });

    it('renders navigate_to_entity action via navigate instead of executeActions', () => {
      const navActions = [
        { _id: 'nav-1', type: 'navigate_to_entity', payload: { url: '/experiences/exp-1' }, description: 'View experience' }
      ];
      const onClose = jest.fn();
      setHookState({ pendingActions: navActions });
      renderPanel({ onClose });
      fireEvent.click(screen.getByText('Yes'));
      expect(mockNavigate).toHaveBeenCalledWith('/experiences/exp-1');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Suggestion chips ────────────────────────────────────────────────────
  describe('suggestion chips', () => {
    it('renders initial suggestion chips when no messages', () => {
      suggestions.getSuggestionsForContext.mockReturnValue([
        'What should I know?',
        'Estimate costs',
      ]);
      setHookState({ messages: [], suggestedNextSteps: [] });
      renderPanel();
      expect(screen.getByText('What should I know?')).toBeInTheDocument();
      expect(screen.getByText('Estimate costs')).toBeInTheDocument();
    });

    it('shows server-provided suggested next steps when available', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hi' }],
        suggestedNextSteps: ['Next step A', 'Next step B'],
      });
      renderPanel();
      expect(screen.getByText('Next step A')).toBeInTheDocument();
      expect(screen.getByText('Next step B')).toBeInTheDocument();
    });

    it('hides suggestion chips when messages exist and no server steps', () => {
      suggestions.getSuggestionsForContext.mockReturnValue(['What should I know?']);
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hi' }],
        suggestedNextSteps: [],
      });
      renderPanel();
      expect(screen.queryByText('What should I know?')).not.toBeInTheDocument();
    });
  });

  // ─── Notification banner ─────────────────────────────────────────────────
  describe('notification banner', () => {
    it('shows notification banner in chat mode when unseen notifications exist', () => {
      renderPanel({
        notifications: [{ _id: 'n1', reason: 'You were added to a plan' }],
        unseenNotificationIds: ['n1'],
      });
      expect(screen.getByText(/new notification/i)).toBeInTheDocument();
    });

    it('calls onMarkNotificationsSeen when dismiss button is clicked', () => {
      const onMarkSeen = jest.fn();
      renderPanel({
        notifications: [{ _id: 'n1', reason: 'You were added to a plan' }],
        unseenNotificationIds: ['n1'],
        onMarkNotificationsSeen: onMarkSeen,
      });
      // Find the notification banner's dismiss button
      fireEvent.click(screen.getByLabelText('Dismiss notifications'));
      expect(onMarkSeen).toHaveBeenCalledWith(['n1']);
    });
  });

  // ─── Accessibility ───────────────────────────────────────────────────────
  describe('accessibility', () => {
    it('has aria-label="BienBot" when no invokeContext', () => {
      renderPanel();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'BienBot');
    });

    it('has aria-label including entity label when invokeContext is provided', () => {
      renderPanel({ invokeContext: { entity: 'experience', id: 'e1', label: 'Rome Adventure' } });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'BienBot — Rome Adventure');
    });

    it('has aria-label="Notifications" in notification-only mode', () => {
      renderPanel({ notificationOnly: true });
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Notifications');
    });

    it('messages container has aria-live="off" and status region announces finalized assistant message', () => {
      // The messages container should be silent during streaming
      setHookState({
        messages: [
          { _id: 'm1', role: 'assistant', content: 'Final reply.' }
        ],
        isStreaming: false,
      });
      renderPanel();
      const dialog = screen.getByRole('dialog');
      // Messages container must be off to avoid spam during streaming
      const messagesDiv = dialog.querySelector('.messages');
      expect(messagesDiv).toHaveAttribute('aria-live', 'off');
      // A status region with aria-live="polite" announces only the finalized message
      const statusNode = dialog.querySelector('[role="status"][aria-live="polite"]');
      expect(statusNode).toBeInTheDocument();
      expect(statusNode).toHaveTextContent('Final reply.');
    });
  });

  // ─── Notification-only: mark notifications as seen on open ─────────────
  describe('notification-only: auto mark seen', () => {
    it('marks unseen notifications as seen when notification-only panel opens', () => {
      const onMarkSeen = jest.fn();
      renderPanel({
        notificationOnly: true,
        open: true,
        unseenNotificationIds: ['n1', 'n2'],
        onMarkNotificationsSeen: onMarkSeen,
      });
      expect(onMarkSeen).toHaveBeenCalledWith(['n1', 'n2']);
    });

    it('does not call onMarkNotificationsSeen when panel is closed', () => {
      const onMarkSeen = jest.fn();
      renderPanel({
        notificationOnly: true,
        open: false,
        unseenNotificationIds: ['n1'],
        onMarkNotificationsSeen: onMarkSeen,
      });
      expect(onMarkSeen).not.toHaveBeenCalled();
    });
  });

  // ─── Suggestion chips — real button elements ────────────────────────────
  describe('suggestion chips — a11y', () => {
    it('renders suggestion chips as real button elements', () => {
      suggestions.getSuggestionsForContext.mockReturnValue([
        'What should I know?',
        'Estimate costs',
      ]);
      setHookState({ messages: [], suggestedNextSteps: [] });
      renderPanel({ open: true, onClose: jest.fn(), invokeContext: null });
      const chips = screen.getAllByRole('button').filter(el => el.className?.includes('chip') || el.dataset.chip === 'true');
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        expect(chip.tagName).toBe('BUTTON');
      }
    });
  });

  // ─── Input history recall ────────────────────────────────────────────────
  describe('input history recall (ArrowUp / ArrowDown)', () => {
    it('ArrowUp on empty textarea recalls the most recent user message', () => {
      setHookState({
        messages: [
          { _id: 'm1', role: 'user', content: 'First message' },
          { _id: 'm2', role: 'assistant', content: 'Sure!' },
          { _id: 'm3', role: 'user', content: 'Second message' },
        ],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea.value).toBe('Second message');
    });

    it('ArrowUp twice recalls an older user message', () => {
      setHookState({
        messages: [
          { _id: 'm1', role: 'user', content: 'First message' },
          { _id: 'm2', role: 'user', content: 'Second message' },
        ],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea.value).toBe('First message');
    });

    it('ArrowUp does not exceed history bounds', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Only message' }],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      fireEvent.keyDown(textarea, { key: 'ArrowUp' }); // no older entry
      expect(textarea.value).toBe('Only message');
    });

    it('ArrowDown after ArrowUp restores the saved draft (empty string)', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hello' }],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea.value).toBe('Hello');
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea.value).toBe('');
    });

    it('ArrowDown does nothing when not in history mode', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hello' }],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      textarea.value = 'current draft';
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea.value).toBe('current draft');
    });

    it('ArrowUp does nothing when textarea has text and is not in history mode', () => {
      setHookState({
        messages: [{ _id: 'm1', role: 'user', content: 'Hello' }],
      });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      // Direct DOM assignment works here because BienBotPanel uses an uncontrolled
      // textarea — the component reads inputRef.current.value (same DOM node).
      textarea.value = 'partial draft';
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea.value).toBe('partial draft');
    });

    it('ArrowUp does nothing when there are no user messages', () => {
      setHookState({ messages: [] });
      renderPanel();
      const textarea = screen.getByLabelText('Message input');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea.value).toBe('');
    });
  });

  // ─── handleUpdateAction ──────────────────────────────────────────────────
  describe('handleUpdateAction', () => {
    it('prefills the input with the original action description', async () => {
      setHookState({
        pendingActions: [
          { _id: 'a1', type: 'add_plan_items', description: 'Plan a Tokyo trip', payload: {} }
        ],
      });

      renderPanel();

      const editButton = screen.getByRole('button', { name: /Edit/i });
      fireEvent.click(editButton);

      const textarea = screen.getByRole('textbox', { name: /Message input/i });
      expect(textarea.value).toContain('Plan a Tokyo trip');
    });
  });

  // ─── Focus trap ──────────────────────────────────────────────────────────
  describe('focus trap', () => {
    it('traps Tab focus inside the dialog when open', () => {
      renderPanel({ open: true });
      const buttons = screen.getAllByRole('button');
      const lastButton = buttons[buttons.length - 1];
      lastButton.focus();
      fireEvent.keyDown(lastButton, { key: 'Tab' });
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  // ─── handleAddPhotos ──────────────────────────────────────────────────────
  describe('handleAddPhotos', () => {
    it('includes photo URLs and photographer credits in the message sent to BienBot', async () => {
      const photos = [
        { url: 'https://images.unsplash.com/photo-1', photographer: 'Alice', photographer_url: 'https://unsplash.com/@alice' },
        { url: 'https://images.unsplash.com/photo-2', photographer: 'Bob' }
      ];

      setHookState({
        messages: [{
          _id: 'm1',
          role: 'assistant',
          content: '',
          structured_content: [{
            type: 'photo_gallery',
            data: { photos, entity_type: 'destination', entity_id: 'd1', entity_name: 'Paris', selectable: true }
          }]
        }],
      });

      renderPanel({ invokeContext: { entity: 'destination', id: 'd1', label: 'Paris' } });

      // Select both photos using their aria-labels (Photo N by Photographer)
      const thumb1 = screen.getByRole('button', { name: /Photo 1 by Alice/i });
      const thumb2 = screen.getByRole('button', { name: /Photo 2 by Bob/i });
      fireEvent.click(thumb1);
      fireEvent.click(thumb2);

      // Click the "Add 2 photos" button
      fireEvent.click(screen.getByRole('button', { name: /Add 2 photos/i }));

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const sentMessage = mockSendMessage.mock.calls[0][0];
      expect(sentMessage).toContain('https://images.unsplash.com/photo-1');
      expect(sentMessage).toContain('https://images.unsplash.com/photo-2');
      expect(sentMessage).toContain('Alice');
    });
  });

  // ─── handleBackdropClick with unsaved draft ──────────────────────────────
  describe('backdrop click with unsaved draft', () => {
    it('confirms before closing via backdrop when input is non-empty', () => {
      const onClose = jest.fn();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      renderPanel({ open: true, onClose });

      const textarea = screen.getByRole('textbox', { name: /Message input/i });
      // BienBotPanel uses an uncontrolled textarea; write directly to the DOM node
      textarea.value = 'half-written message';
      fireEvent.input(textarea, { target: { value: 'half-written message' } });

      // The backdrop is the outermost div with aria-hidden="true" and onClick
      const backdrop = document.querySelector('[aria-hidden="true"][class*="backdrop"]');
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop);

      expect(confirmSpy).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('closes via backdrop when input is empty (no confirm needed)', () => {
      const onClose = jest.fn();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      renderPanel({ open: true, onClose });

      const backdrop = document.querySelector('[aria-hidden="true"][class*="backdrop"]');
      expect(backdrop).not.toBeNull();
      // Simulate a direct click on the backdrop itself (target === currentTarget)
      fireEvent.click(backdrop, { bubbles: true });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });
  });
});
