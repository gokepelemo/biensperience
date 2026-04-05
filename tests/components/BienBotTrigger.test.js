/**
 * Tests for BienBotTrigger component
 *
 * Tests cover:
 * - Returns null when no user
 * - Shows AI smiley icon when ai_features flag is enabled
 * - Shows bell icon when ai_features is disabled
 * - Shows notification badge when unseenNotificationIds > 0
 * - Badge not shown when no unseen notifications
 * - Accessibility: aria-label for chat mode
 * - Accessibility: aria-label for notification mode
 * - Opens panel on FAB click
 * - Super admins get chat access even without ai_features flag
 * - Explicit entity props override route context
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Mock event-bus ────────────────────────────────────────────────────────
const mockSubscribeHandlers = {};
jest.mock('../../src/utilities/event-bus', () => ({
  subscribeToEvent: jest.fn((eventType, handler) => {
    mockSubscribeHandlers[eventType] = handler;
    return jest.fn();
  }),
  broadcastEvent: jest.fn(),
}));

// ─── Mock react-router-dom ─────────────────────────────────────────────────
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  useParams: () => ({}),
}));

// ─── Mock useUser ────────────────────────────────────────────────────────────
jest.mock('../../src/contexts/UserContext', () => ({
  useUser: jest.fn(() => ({ user: null })),
}));

// ─── Mock useFeatureFlag ─────────────────────────────────────────────────────
jest.mock('../../src/hooks/useFeatureFlag', () => ({
  __esModule: true,
  default: jest.fn(() => ({ enabled: false, config: null })),
  useFeatureFlag: jest.fn(() => ({ enabled: false, config: null })),
}));

// ─── Mock permissions ────────────────────────────────────────────────────────
jest.mock('../../src/utilities/permissions', () => ({
  isSuperAdmin: jest.fn(() => false),
}));

// ─── Mock useRouteContext ─────────────────────────────────────────────────────
jest.mock('../../src/hooks/useRouteContext', () =>
  jest.fn(() => ({
    invokeContext: null,
    currentView: null,
    isEntityView: false,
  }))
);

// ─── Mock BienBotPanel (lazy-loaded) ─────────────────────────────────────────
// BienBotPanelLazy does a dynamic import; mock the whole BienBotPanel module.
// Must export __esModule + default so that `import(...).then(mod => mod.default)` works.
const MockBienBotPanel = jest.fn((props) => {
  const React = require('react');
  return props.open
    ? React.createElement('div', {
        'data-testid': 'bienbot-panel',
        role: 'dialog',
      }, React.createElement('button', { onClick: props.onClose }, 'Close Panel'))
    : null;
});

jest.mock('../../src/components/BienBotPanel/BienBotPanel', () => ({
  __esModule: true,
  default: MockBienBotPanel,
}));

// ─── Mock react-icons ────────────────────────────────────────────────────────
jest.mock('react-icons/fa', () => ({
  FaBell: ({ size }) =>
    require('react').createElement('svg', { 'data-testid': 'bell-icon', 'aria-hidden': 'true', width: size, height: size }),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import BienBotTrigger from '../../src/components/BienBotTrigger/BienBotTrigger';
import { useUser } from '../../src/contexts/UserContext';
import { useFeatureFlag } from '../../src/hooks/useFeatureFlag';
import { isSuperAdmin } from '../../src/utilities/permissions';
import useRouteContext from '../../src/hooks/useRouteContext';

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUser = { _id: 'user-1', name: 'Alice', emailConfirmed: true };

function setUser(user) {
  useUser.mockReturnValue({ user });
}

function setAIEnabled(enabled) {
  useFeatureFlag.mockReturnValue({ enabled, config: null });
}

function setAdmin(isAdmin) {
  isSuperAdmin.mockReturnValue(isAdmin);
}

function renderTrigger(props = {}) {
  return render(<BienBotTrigger {...props} />);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BienBotTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser(null);
    setAIEnabled(false);
    setAdmin(false);
    useRouteContext.mockReturnValue({
      invokeContext: null,
      currentView: null,
      isEntityView: false,
    });
  });

  // ─── Authentication guard ──────────────────────────────────────────────
  describe('authentication guard', () => {
    it('renders nothing when no user is logged in', () => {
      const { container } = renderTrigger();
      expect(container.firstChild).toBeNull();
    });

    it('renders FAB when user is logged in', () => {
      setUser(mockUser);
      renderTrigger();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  // ─── Chat vs notification mode ─────────────────────────────────────────
  describe('chat vs notification mode', () => {
    it('shows bell icon when ai_features is disabled and user has no admin role', () => {
      setUser(mockUser);
      setAIEnabled(false);
      setAdmin(false);
      renderTrigger();
      expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
    });

    it('shows smiley/chat icon (SVG) when ai_features is enabled', () => {
      setUser(mockUser);
      setAIEnabled(true);
      renderTrigger();
      // The chat icon is an inline SVG (not bell-icon)
      expect(screen.queryByTestId('bell-icon')).not.toBeInTheDocument();
      // The FAB button should still render
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows chat icon when user is super admin even without ai_features flag', () => {
      setUser(mockUser);
      setAIEnabled(false);
      setAdmin(true);
      renderTrigger();
      // Super admins get chat access; bell-icon should NOT be shown
      expect(screen.queryByTestId('bell-icon')).not.toBeInTheDocument();
    });
  });

  // ─── Notification badge ────────────────────────────────────────────────
  describe('notification badge', () => {
    it('does not render a badge when unseenNotificationIds is empty', () => {
      setUser(mockUser);
      renderTrigger({ unseenNotificationIds: [] });
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
    });

    it('shows badge count for unseen notifications', () => {
      setUser(mockUser);
      renderTrigger({ unseenNotificationIds: ['n1', 'n2', 'n3'] });
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows "99+" when unseen count exceeds 99', () => {
      setUser(mockUser);
      const ids = Array.from({ length: 100 }, (_, i) => `n${i}`);
      renderTrigger({ unseenNotificationIds: ids });
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────
  describe('accessibility', () => {
    it('has generic "Open BienBot assistant" aria-label when chat enabled and no context', () => {
      setUser(mockUser);
      setAIEnabled(true);
      renderTrigger();
      expect(screen.getByLabelText('Open BienBot assistant')).toBeInTheDocument();
    });

    it('includes entity label in aria-label when invokeContext is provided', () => {
      setUser(mockUser);
      setAIEnabled(true);
      useRouteContext.mockReturnValue({
        invokeContext: { entity: 'experience', id: 'exp-1', label: 'Paris Trip' },
        currentView: null,
        isEntityView: true,
      });
      renderTrigger();
      expect(screen.getByLabelText('Open BienBot assistant for Paris Trip')).toBeInTheDocument();
    });

    it('shows notification count in aria-label when no chat access and unseen exist', () => {
      setUser(mockUser);
      setAIEnabled(false);
      setAdmin(false);
      renderTrigger({ unseenNotificationIds: ['n1', 'n2'] });
      expect(screen.getByLabelText('2 new notifications')).toBeInTheDocument();
    });

    it('shows "Notifications" aria-label when no chat access and no unseen', () => {
      setUser(mockUser);
      setAIEnabled(false);
      setAdmin(false);
      renderTrigger({ unseenNotificationIds: [] });
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });

  // ─── Panel open/close ─────────────────────────────────────────────────
  describe('panel open/close', () => {
    it('FAB is visible before panel is opened', () => {
      setUser(mockUser);
      setAIEnabled(true);
      renderTrigger();
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.queryByTestId('bienbot-panel')).not.toBeInTheDocument();
    });

    it('hides FAB and shows panel after clicking FAB', async () => {
      setUser(mockUser);
      setAIEnabled(true);

      renderTrigger();
      const fab = screen.getByRole('button');

      await act(async () => {
        fireEvent.click(fab);
      });

      // After clicking, BienBotPanelLazy resolves its dynamic import and
      // sets the Panel state; waitFor handles the async React update.
      await waitFor(() => {
        expect(screen.getByTestId('bienbot-panel')).toBeInTheDocument();
      });
    });
  });

  // ─── analysisSuggestions ──────────────────────────────────────────────
  describe('analysisSuggestions', () => {
    it('stores analysisSuggestions and passes them to the panel when bienbot:open fires with analysisSuggestions', async () => {
      const { useFeatureFlag } = require('../../src/hooks/useFeatureFlag');
      useFeatureFlag.mockReturnValue({ enabled: true });
      const { useUser } = require('../../src/contexts/UserContext');
      useUser.mockReturnValue({ user: { _id: 'u1', role: 'regular_user' } });

      render(<BienBotTrigger />);

      const suggestions = [{ type: 'tip', message: 'Add transport.' }];

      await act(async () => {
        mockSubscribeHandlers['bienbot:open']?.({
          analysisSuggestions: { entity: 'experience', entityLabel: 'Tokyo Walk', suggestions },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('bienbot-panel')).toBeInTheDocument();
      });

      expect(MockBienBotPanel).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisSuggestions: { entity: 'experience', entityLabel: 'Tokyo Walk', suggestions },
        }),
        expect.anything()
      );
    });
  });

  // ─── Entity prop override ──────────────────────────────────────────────
  describe('entity prop override', () => {
    it('uses explicit entity props over route context', () => {
      setUser(mockUser);
      setAIEnabled(true);
      useRouteContext.mockReturnValue({
        invokeContext: { entity: 'destination', id: 'dest-1', label: 'Route Label' },
        currentView: null,
        isEntityView: true,
      });

      renderTrigger({
        entity: 'experience',
        entityId: 'exp-1',
        entityLabel: 'My Experience Override',
      });

      // aria-label should use the explicit prop, not route context
      expect(screen.getByLabelText('Open BienBot assistant for My Experience Override')).toBeInTheDocument();
    });
  });
});
