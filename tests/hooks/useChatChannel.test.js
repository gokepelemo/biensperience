/**
 * Tests for useChatChannel — the Stream Chat init/cleanup wiring used by
 * PlanItemDetailsModal. Mocks the underlying useStreamChat hook and the
 * channel-creation API; the test exercises the gating around `canInitChat`,
 * channel creation/teardown across plan-item swaps, and the chat-loading
 * derived flags.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockUseStreamChat = jest.fn();
const mockGetOrCreatePlanItemChannel = jest.fn();
const mockGetFriendlyChatErrorMessage = jest.fn(() => 'Failed to initialize chat');

jest.mock('../../src/hooks/useStreamChat', () => ({
  __esModule: true,
  default: (args) => mockUseStreamChat(args),
}));

jest.mock('../../src/utilities/chat-api', () => ({
  getOrCreatePlanItemChannel: (...args) => mockGetOrCreatePlanItemChannel(...args),
}));

jest.mock('../../src/utilities/chat-error-utils', () => ({
  getFriendlyChatErrorMessage: (...args) => mockGetFriendlyChatErrorMessage(...args),
}));

jest.mock('../../src/utilities/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import useChatChannel from '../../src/hooks/useChatChannel';

function makeStreamClient(channelImpl) {
  return {
    channel: jest.fn(() => channelImpl),
  };
}

beforeEach(() => {
  mockUseStreamChat.mockReset();
  mockGetOrCreatePlanItemChannel.mockReset();
});

describe('useChatChannel', () => {
  it('canInitChat is false when activeTab is not chat', () => {
    mockUseStreamChat.mockReturnValue({ client: null, loading: false, error: null });
    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'details',
        apiKey: 'key',
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );
    expect(result.current.canInitChat).toBe(false);
    expect(mockGetOrCreatePlanItemChannel).not.toHaveBeenCalled();
  });

  it('canInitChat is false when apiKey is missing', () => {
    mockUseStreamChat.mockReturnValue({ client: null, loading: false, error: null });
    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'chat',
        apiKey: null,
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );
    expect(result.current.canInitChat).toBe(false);
  });

  it('creates and watches a channel when canInitChat becomes true and a client is available', async () => {
    const channelImpl = { watch: jest.fn().mockResolvedValue() };
    const client = makeStreamClient(channelImpl);
    mockUseStreamChat.mockReturnValue({ client, loading: false, error: null });
    mockGetOrCreatePlanItemChannel.mockResolvedValue({ id: 'channel-A' });

    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'chat',
        apiKey: 'key',
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );

    await waitFor(() => expect(result.current.chatChannel).toBe(channelImpl));
    expect(mockGetOrCreatePlanItemChannel).toHaveBeenCalledWith('p1', 'i1');
    expect(client.channel).toHaveBeenCalledWith('messaging', 'channel-A');
    expect(channelImpl.watch).toHaveBeenCalled();
  });

  it('surfaces a friendly error message when channel creation throws', async () => {
    const client = makeStreamClient({ watch: jest.fn() });
    mockUseStreamChat.mockReturnValue({ client, loading: false, error: null });
    mockGetOrCreatePlanItemChannel.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'chat',
        apiKey: 'key',
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );

    await waitFor(() =>
      expect(result.current.mergedChatError).toBe('Failed to initialize chat')
    );
  });

  it('chatShouldShowLoading is true while canInitChat is true and no channel is available yet', () => {
    mockUseStreamChat.mockReturnValue({ client: null, loading: true, error: null });
    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'chat',
        apiKey: 'key',
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );
    expect(result.current.chatShouldShowLoading).toBe(true);
  });

  it('clears chat state when modal closes (show toggles to false)', async () => {
    const channelImpl = { watch: jest.fn().mockResolvedValue() };
    const client = makeStreamClient(channelImpl);
    mockUseStreamChat.mockReturnValue({ client, loading: false, error: null });
    mockGetOrCreatePlanItemChannel.mockResolvedValue({ id: 'channel-A' });

    const { result, rerender } = renderHook(
      ({ show }) =>
        useChatChannel({
          show,
          activeTab: 'chat',
          apiKey: 'key',
          plan: { _id: 'p1' },
          planItem: { _id: 'i1' },
        }),
      { initialProps: { show: true } }
    );

    await waitFor(() => expect(result.current.chatChannel).toBe(channelImpl));
    rerender({ show: false });
    expect(result.current.chatChannel).toBeNull();
  });

  it('returns light/dark uiTheme based on documentElement data-theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    mockUseStreamChat.mockReturnValue({ client: null, loading: false, error: null });
    const { result } = renderHook(() =>
      useChatChannel({
        show: true,
        activeTab: 'chat',
        apiKey: 'key',
        plan: { _id: 'p1' },
        planItem: { _id: 'i1' },
      })
    );
    expect(result.current.uiTheme).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
  });
});
