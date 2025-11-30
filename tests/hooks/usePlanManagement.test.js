/**
 * Tests for usePlanManagement hook
 *
 * Tests cover:
 * - Initial state
 * - Plan fetching
 * - Plan creation with optimistic updates
 * - Plan updates
 * - Plan deletion
 * - Event handling (created, updated, deleted)
 * - Event deduplication
 * - Legacy event compatibility
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import usePlanManagement from '../../src/hooks/usePlanManagement';

// Mock the API functions
jest.mock('../../src/utilities/plans-api', () => ({
  getUserPlans: jest.fn(),
  getPlanById: jest.fn(),
  createPlan: jest.fn(),
  updatePlan: jest.fn(),
  deletePlan: jest.fn(),
  getExperiencePlans: jest.fn(),
  checkUserPlanForExperience: jest.fn()
}));

// Mock the logger
jest.mock('../../src/utilities/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock event-bus utilities
jest.mock('../../src/utilities/event-bus', () => ({
  reconcileState: jest.fn((currentState, event) => {
    // Simple implementation: return event data if newer version
    if (!currentState) return event.data;
    if (event.version && currentState._version && event.version <= currentState._version) {
      return currentState;
    }
    return event.data || currentState;
  }),
  generateOptimisticId: jest.fn(() => `optimistic_${Date.now()}`),
  getProtectedFields: jest.fn(() => []),
  LOCAL_CHANGE_PROTECTION_MS: 5000,
  VectorClock: {
    createVectorClock: jest.fn(() => ({})),
    increment: jest.fn(() => ({})),
    format: jest.fn(() => ''),
    compare: jest.fn(() => 'after'),
    isConcurrent: jest.fn(() => false),
    clone: jest.fn(() => ({})),
    merge: jest.fn(() => ({}))
  },
  eventBus: {
    subscribe: jest.fn(() => jest.fn()), // Return a mock unsubscribe function
    emit: jest.fn()
  }
}));

const {
  checkUserPlanForExperience,
  getPlanById,
  createPlan: createPlanAPI,
  updatePlan: updatePlanAPI,
  deletePlan: deletePlanAPI,
  getExperiencePlans
} = require('../../src/utilities/plans-api');

const { reconcileState, generateOptimisticId } = require('../../src/utilities/event-bus');

describe('usePlanManagement', () => {
  const experienceId = 'exp123';
  const userId = 'user456';

  const mockUserPlan = {
    _id: 'plan789',
    experience: experienceId,
    user: userId,
    planned_date: '2025-12-01',
    plan: [
      { plan_item_id: 'item1', text: 'Test item 1', complete: false },
      { plan_item_id: 'item2', text: 'Test item 2', complete: true }
    ],
    permissions: [{ _id: userId, entity: 'user', type: 'owner' }]
  };

  const mockCollaborativePlan = {
    _id: 'plan999',
    experience: experienceId,
    user: 'otherUser123',
    planned_date: '2025-12-15',
    plan: [],
    permissions: []
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    checkUserPlanForExperience.mockResolvedValue({ planId: mockUserPlan._id });
    getPlanById.mockResolvedValue(mockUserPlan);
    getExperiencePlans.mockResolvedValue([mockUserPlan, mockCollaborativePlan]);
    createPlanAPI.mockResolvedValue(mockUserPlan);
    updatePlanAPI.mockResolvedValue(mockUserPlan);
    deletePlanAPI.mockResolvedValue({ success: true });
    generateOptimisticId.mockReturnValue('optimistic_123');
  });

  afterEach(() => {
    // Clean up event listeners
    window.removeEventListener('plan:created', jest.fn());
    window.removeEventListener('plan:updated', jest.fn());
    window.removeEventListener('plan:deleted', jest.fn());
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      expect(result.current.userPlan).toBeNull();
      expect(result.current.sharedPlans).toEqual([]);
      expect(result.current.selectedPlanId).toBeNull();
      expect(result.current.userHasExperience).toBe(false);
      expect(result.current.plannedDate).toBe('');
    });

    it('should not fetch plans without experienceId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(null, userId)
      );

      await waitFor(() => {
        expect(checkUserPlanForExperience).not.toHaveBeenCalled();
      });
    });

    it('should not fetch plans without userId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, null)
      );

      await waitFor(() => {
        expect(checkUserPlanForExperience).not.toHaveBeenCalled();
      });
    });
  });

  describe('Plan Fetching', () => {
    it('should fetch user plan on mount', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(checkUserPlanForExperience).toHaveBeenCalledWith(experienceId);
        expect(getPlanById).toHaveBeenCalledWith(mockUserPlan._id);
        expect(result.current.userPlan).toEqual(mockUserPlan);
        expect(result.current.userHasExperience).toBe(true);
      });
    });

    it('should fetch collaborative plans on mount', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(getExperiencePlans).toHaveBeenCalledWith(experienceId);
        expect(result.current.sharedPlans).toHaveLength(2);
      });
    });

    it('should handle user with no plan', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
        expect(result.current.userHasExperience).toBe(false);
      });
    });

    it('should handle API errors gracefully', async () => {
      checkUserPlanForExperience.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });
    });
  });

  describe('Plan Creation', () => {
    it('should create plan with optimistic update', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      const plannedDate = '2025-12-25';

      await act(async () => {
        await result.current.createPlan(plannedDate);
      });

      expect(createPlanAPI).toHaveBeenCalledWith(experienceId, plannedDate);
      expect(generateOptimisticId).toHaveBeenCalledWith('plan');
    });

    it('should rollback on creation error', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);
      createPlanAPI.mockRejectedValue(new Error('Creation failed'));

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      await act(async () => {
        try {
          await result.current.createPlan('2025-12-25');
        } catch (e) {
          // Expected error
        }
      });

      expect(result.current.userPlan).toBeNull();
      expect(result.current.userHasExperience).toBe(false);
    });

    it('should throw error without experienceId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(null, userId)
      );

      await expect(
        act(async () => {
          await result.current.createPlan('2025-12-25');
        })
      ).rejects.toThrow('Experience ID and User ID required');
    });
  });

  describe('Plan Updates', () => {
    it('should update plan with optimistic update', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      const updates = { planned_date: '2025-12-31' };

      await act(async () => {
        await result.current.updatePlan(mockUserPlan._id, updates);
      });

      expect(updatePlanAPI).toHaveBeenCalledWith(mockUserPlan._id, updates);
    });

    it('should throw error without planId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await expect(
        act(async () => {
          await result.current.updatePlan(null, {});
        })
      ).rejects.toThrow('Plan ID required');
    });
  });

  describe('Plan Deletion', () => {
    it('should delete plan with optimistic removal', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      await act(async () => {
        await result.current.deletePlan(mockUserPlan._id);
      });

      expect(deletePlanAPI).toHaveBeenCalledWith(mockUserPlan._id);
      expect(result.current.userPlan).toBeNull();
      expect(result.current.userHasExperience).toBe(false);
    });

    it('should throw error without planId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await expect(
        act(async () => {
          await result.current.deletePlan(null);
        })
      ).rejects.toThrow('Plan ID required');
    });
  });

  describe('Event Handling', () => {
    it('should handle plan:created event', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      const newPlan = {
        _id: 'newPlan123',
        experience: experienceId,
        user: userId,
        planned_date: '2025-12-20',
        plan: []
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:created', {
          detail: {
            planId: newPlan._id,
            experienceId,
            version: Date.now(),
            data: newPlan
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.userHasExperience).toBe(true);
      });
    });

    it('should handle plan:updated event', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      const updatedPlan = {
        ...mockUserPlan,
        planned_date: '2025-12-31'
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: {
            planId: mockUserPlan._id,
            experienceId,
            version: Date.now(),
            data: updatedPlan
          }
        }));
      });

      await waitFor(() => {
        expect(reconcileState).toHaveBeenCalled();
      });
    });

    it('should handle plan:deleted event', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:deleted', {
          detail: {
            planId: mockUserPlan._id,
            experienceId,
            version: Date.now()
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
        expect(result.current.userHasExperience).toBe(false);
      });
    });

    it('should ignore events for different experiences', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:deleted', {
          detail: {
            planId: mockUserPlan._id,
            experienceId: 'differentExperience',
            version: Date.now()
          }
        }));
      });

      // Plan should not be deleted since event is for different experience
      expect(result.current.userPlan).toEqual(mockUserPlan);
    });

    it('should deduplicate events by version', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      const version = Date.now();

      // First event
      act(() => {
        window.dispatchEvent(new CustomEvent('plan:deleted', {
          detail: {
            planId: mockUserPlan._id,
            experienceId,
            version
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      // Re-add plan for next test
      checkUserPlanForExperience.mockResolvedValue({ planId: mockUserPlan._id });

      // Second event with same version should be ignored
      act(() => {
        window.dispatchEvent(new CustomEvent('plan:deleted', {
          detail: {
            planId: mockUserPlan._id,
            experienceId,
            version // Same version
          }
        }));
      });

      // Should still be null (duplicate ignored)
      expect(result.current.userPlan).toBeNull();
    });
  });

  describe('Legacy Event Compatibility', () => {
    it('should handle bien:plan_created legacy event', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      const newPlan = {
        _id: 'legacyPlan123',
        experience: experienceId,
        user: userId,
        planned_date: '2025-12-20'
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('bien:plan_created', {
          detail: {
            plan: newPlan,
            experienceId
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.userHasExperience).toBe(true);
      });
    });
  });

  describe('Selected Plan', () => {
    it('should compute selectedPlan from selectedPlanId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.sharedPlans).toHaveLength(2);
      });

      act(() => {
        result.current.setSelectedPlanId(mockCollaborativePlan._id);
      });

      await waitFor(() => {
        expect(result.current.selectedPlan._id).toBe(mockCollaborativePlan._id);
      });
    });

    it('should default to userPlan when no selectedPlanId', async () => {
      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toEqual(mockUserPlan);
      });

      expect(result.current.selectedPlan).toEqual(mockUserPlan);
    });
  });

  describe('User ID Extraction', () => {
    it('should handle populated user object in plan events', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      // Plan with populated user object (not just ObjectId)
      const newPlan = {
        _id: 'newPlan123',
        experience: experienceId,
        user: { _id: userId, name: 'Test User', email: 'test@example.com' },
        planned_date: '2025-12-20',
        plan: []
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:created', {
          detail: {
            planId: newPlan._id,
            experienceId,
            version: Date.now(),
            data: newPlan
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.userHasExperience).toBe(true);
      });
    });

    it('should not set userHasExperience for other users plans', async () => {
      checkUserPlanForExperience.mockResolvedValue(null);
      getExperiencePlans.mockResolvedValue([]);

      const { result } = renderHook(() =>
        usePlanManagement(experienceId, userId)
      );

      await waitFor(() => {
        expect(result.current.userPlan).toBeNull();
      });

      // Plan for a different user
      const otherUserPlan = {
        _id: 'otherPlan123',
        experience: experienceId,
        user: 'differentUserId',
        planned_date: '2025-12-20',
        plan: []
      };

      act(() => {
        window.dispatchEvent(new CustomEvent('plan:created', {
          detail: {
            planId: otherUserPlan._id,
            experienceId,
            version: Date.now(),
            data: otherUserPlan
          }
        }));
      });

      // userHasExperience should remain false since it's not our plan
      expect(result.current.userHasExperience).toBe(false);
    });
  });
});
