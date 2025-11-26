/**
 * Tests for usePlanItemManager hook
 * Tests plan item CRUD operations with optimistic UI patterns
 */

import { renderHook, act } from '@testing-library/react-hooks';
import usePlanItemManager from '../../src/hooks/usePlanItemManager';
import * as plansApi from '../../src/utilities/plans-api';
import { handleError } from '../../src/utilities/error-handler';

// Mock dependencies
jest.mock('../../src/utilities/plans-api');
jest.mock('../../src/utilities/error-handler');
jest.mock('../../src/hooks/useOptimisticAction', () => {
  return jest.fn(({ apply, apiCall, rollback, onSuccess, onError }) => {
    return async () => {
      try {
        apply();
        await apiCall();
        if (onSuccess) await onSuccess();
      } catch (err) {
        rollback();
        if (onError) onError(err, 'Operation failed');
      }
    };
  });
});

describe('usePlanItemManager', () => {
  // Default mock props
  const createMockProps = (overrides = {}) => ({
    plan: { _id: 'plan-123', plan: [] },
    experience: { _id: 'exp-456', plan_items: [] },
    collaborativePlans: [{ _id: 'plan-123', plan: [] }],
    setCollaborativePlans: jest.fn(),
    setExperience: jest.fn(),
    fetchCollaborativePlans: jest.fn().mockResolvedValue([]),
    fetchUserPlan: jest.fn().mockResolvedValue(null),
    fetchPlans: jest.fn().mockResolvedValue([]),
    fetchExperience: jest.fn().mockResolvedValue({}),
    showError: jest.fn(),
    mode: 'plan',
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    handleError.mockReturnValue('Handled error message');
  });

  describe('Initial State', () => {
    it('should initialize with default modal states', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      expect(result.current.showModal).toBe(false);
      expect(result.current.showDeleteModal).toBe(false);
      expect(result.current.formState).toBe(1); // Add mode
      expect(result.current.editingItem).toEqual({});
    });

    it('should expose all required handlers', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      expect(typeof result.current.handleAddItem).toBe('function');
      expect(typeof result.current.handleEditItem).toBe('function');
      expect(typeof result.current.handleSaveItem).toBe('function');
      expect(typeof result.current.handleDeleteItem).toBe('function');
      expect(typeof result.current.confirmDeleteItem).toBe('function');
      expect(typeof result.current.handleInputChange).toBe('function');
      expect(typeof result.current.handleNumericChange).toBe('function');
      expect(typeof result.current.closeModal).toBe('function');
      expect(typeof result.current.closeDeleteModal).toBe('function');
    });
  });

  describe('Modal Controls', () => {
    it('should open add modal with handleAddItem', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      expect(result.current.showModal).toBe(true);
      expect(result.current.formState).toBe(1); // Add mode
      expect(result.current.editingItem).toEqual({});
    });

    it('should open add modal with parent ID when provided', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem('parent-item-123');
      });

      expect(result.current.showModal).toBe(true);
      expect(result.current.editingItem).toEqual({ parent: 'parent-item-123' });
    });

    it('should close modal and reset state', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Open modal first
      act(() => {
        result.current.handleAddItem();
      });
      expect(result.current.showModal).toBe(true);

      // Close modal
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.showModal).toBe(false);
      expect(result.current.editingItem).toEqual({});
    });

    it('should open delete confirmation modal', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const itemToDelete = { _id: 'item-123', text: 'Test item' };

      act(() => {
        result.current.confirmDeleteItem(itemToDelete);
      });

      expect(result.current.showDeleteModal).toBe(true);
    });

    it('should close delete modal', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Open delete modal first
      act(() => {
        result.current.confirmDeleteItem({ _id: 'item-123' });
      });
      expect(result.current.showDeleteModal).toBe(true);

      // Close delete modal
      act(() => {
        result.current.closeDeleteModal();
      });

      expect(result.current.showDeleteModal).toBe(false);
    });
  });

  describe('Plan Mode - Edit Item', () => {
    it('should open edit modal with plan item data', () => {
      const mockProps = createMockProps({ mode: 'plan' });
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const planItem = {
        _id: 'item-123',
        plan_item_id: 'plan-item-123',
        text: 'Test item',
        url: 'https://example.com',
        cost: 50,
        planning_days: 2,
        parent: null
      };

      act(() => {
        result.current.handleEditItem(planItem);
      });

      expect(result.current.showModal).toBe(true);
      expect(result.current.formState).toBe(0); // Edit mode
      expect(result.current.editingItem).toEqual({
        _id: 'item-123',
        plan_item_id: 'plan-item-123',
        text: 'Test item',
        url: 'https://example.com',
        cost: 50,
        planning_days: 2,
        parent: null
      });
    });

    it('should handle missing optional fields with defaults', () => {
      const mockProps = createMockProps({ mode: 'plan' });
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const planItem = {
        _id: 'item-123',
        plan_item_id: 'plan-item-123',
        text: 'Test item'
        // Missing url, cost, planning_days, parent
      };

      act(() => {
        result.current.handleEditItem(planItem);
      });

      expect(result.current.editingItem.url).toBe('');
      expect(result.current.editingItem.cost).toBe(0);
      expect(result.current.editingItem.planning_days).toBe(0);
      expect(result.current.editingItem.parent).toBe(null);
    });
  });

  describe('Experience Mode - Edit Item', () => {
    it('should open edit modal with experience item data', () => {
      const mockProps = createMockProps({ mode: 'experience' });
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const experienceItem = {
        _id: 'item-456',
        text: 'Experience item',
        url: 'https://example.com',
        cost_estimate: 100,
        planning_days: 3,
        parent: 'parent-123'
      };

      act(() => {
        result.current.handleEditItem(experienceItem);
      });

      expect(result.current.showModal).toBe(true);
      expect(result.current.formState).toBe(0);
      expect(result.current.editingItem).toEqual({
        _id: 'item-456',
        text: 'Experience item',
        url: 'https://example.com',
        cost: 100, // Note: cost_estimate mapped to cost
        planning_days: 3,
        parent: 'parent-123'
      });
    });
  });

  describe('Form Input Handlers', () => {
    it('should handle text input changes', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Open modal first to have an editing item
      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleInputChange({
          target: { name: 'text', value: 'New item text' }
        });
      });

      expect(result.current.editingItem.text).toBe('New item text');
    });

    it('should handle URL input changes', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleInputChange({
          target: { name: 'url', value: 'https://new-url.com' }
        });
      });

      expect(result.current.editingItem.url).toBe('https://new-url.com');
    });

    it('should handle numeric input changes', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleNumericChange({
          target: { name: 'cost', value: '99.99' }
        });
      });

      expect(result.current.editingItem.cost).toBe(99.99);
    });

    it('should handle invalid numeric input as 0', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleNumericChange({
          target: { name: 'cost', value: 'invalid' }
        });
      });

      expect(result.current.editingItem.cost).toBe(0);
    });

    it('should handle planning_days numeric changes', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleNumericChange({
          target: { name: 'planning_days', value: '5' }
        });
      });

      expect(result.current.editingItem.planning_days).toBe(5);
    });
  });

  describe('Plan Mode - Save Item', () => {
    it('should add new plan item with optimistic update', async () => {
      const setCollaborativePlans = jest.fn();
      const fetchCollaborativePlans = jest.fn().mockResolvedValue([]);
      const fetchUserPlan = jest.fn().mockResolvedValue(null);
      const fetchPlans = jest.fn().mockResolvedValue([]);

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: [{ _id: 'plan-123', plan: [] }],
        setCollaborativePlans,
        fetchCollaborativePlans,
        fetchUserPlan,
        fetchPlans
      });

      plansApi.addPlanItemToInstance.mockResolvedValue({ _id: 'new-item-123' });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Open add modal and fill form
      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleInputChange({ target: { name: 'text', value: 'New plan item' } });
        result.current.handleNumericChange({ target: { name: 'cost', value: '50' } });
      });

      // Save item
      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      // Verify API was called
      expect(plansApi.addPlanItemToInstance).toHaveBeenCalledWith('plan-123', expect.objectContaining({
        text: 'New plan item',
        cost: 50
      }));

      // Verify refresh functions called
      expect(fetchCollaborativePlans).toHaveBeenCalled();
      expect(fetchUserPlan).toHaveBeenCalled();
      expect(fetchPlans).toHaveBeenCalled();
    });

    it('should update existing plan item', async () => {
      const setCollaborativePlans = jest.fn();
      const existingItem = { _id: 'item-123', plan_item_id: 'pi-123', text: 'Original', cost: 10 };

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: [{ _id: 'plan-123', plan: [existingItem] }],
        setCollaborativePlans
      });

      plansApi.updatePlanItem.mockResolvedValue({ _id: 'item-123', text: 'Updated' });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Open edit modal
      act(() => {
        result.current.handleEditItem(existingItem);
      });

      // Update text
      act(() => {
        result.current.handleInputChange({ target: { name: 'text', value: 'Updated text' } });
      });

      // Save
      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(plansApi.updatePlanItem).toHaveBeenCalledWith(
        'plan-123',
        'item-123',
        expect.objectContaining({ text: 'Updated text' })
      );
    });

    it('should not save if no plan selected', async () => {
      const mockProps = createMockProps({
        plan: null
      });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(plansApi.addPlanItemToInstance).not.toHaveBeenCalled();
    });
  });

  describe('Experience Mode - Save Item', () => {
    it('should add new experience plan item', async () => {
      const setExperience = jest.fn();
      const fetchExperience = jest.fn().mockResolvedValue({});

      const mockProps = createMockProps({
        mode: 'experience',
        experience: { _id: 'exp-123', plan_items: [] },
        setExperience,
        fetchExperience
      });

      plansApi.addExperiencePlanItem.mockResolvedValue({ _id: 'new-exp-item' });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
      });

      act(() => {
        result.current.handleInputChange({ target: { name: 'text', value: 'New experience item' } });
        result.current.handleNumericChange({ target: { name: 'cost', value: '75' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(plansApi.addExperiencePlanItem).toHaveBeenCalledWith('exp-123', expect.objectContaining({
        text: 'New experience item',
        cost_estimate: 75
      }));
      expect(fetchExperience).toHaveBeenCalled();
    });

    it('should update existing experience plan item', async () => {
      const setExperience = jest.fn();
      const existingItem = { _id: 'item-456', text: 'Original', cost_estimate: 100 };

      const mockProps = createMockProps({
        mode: 'experience',
        experience: { _id: 'exp-123', plan_items: [existingItem] },
        setExperience
      });

      plansApi.updateExperiencePlanItem.mockResolvedValue({ _id: 'item-456' });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleEditItem(existingItem);
      });

      act(() => {
        result.current.handleInputChange({ target: { name: 'text', value: 'Updated experience item' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(plansApi.updateExperiencePlanItem).toHaveBeenCalledWith('exp-123', expect.objectContaining({
        _id: 'item-456',
        text: 'Updated experience item'
      }));
    });
  });

  describe('Delete Plan Item', () => {
    it('should delete plan item with optimistic update', async () => {
      const setCollaborativePlans = jest.fn();
      const itemToDelete = { _id: 'item-123', text: 'Delete me' };

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: [{ _id: 'plan-123', plan: [itemToDelete] }],
        setCollaborativePlans
      });

      plansApi.deletePlanItemFromInstance.mockResolvedValue({});

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Confirm delete
      act(() => {
        result.current.confirmDeleteItem(itemToDelete);
      });

      // Execute delete
      await act(async () => {
        await result.current.handleDeleteItem();
      });

      expect(plansApi.deletePlanItemFromInstance).toHaveBeenCalledWith('plan-123', 'item-123');
    });

    it('should not delete if no plan selected', async () => {
      const mockProps = createMockProps({
        plan: null
      });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.confirmDeleteItem({ _id: 'item-123' });
      });

      await act(async () => {
        await result.current.handleDeleteItem();
      });

      expect(plansApi.deletePlanItemFromInstance).not.toHaveBeenCalled();
    });

    it('should not delete if no item selected', async () => {
      const mockProps = createMockProps({
        plan: { _id: 'plan-123' }
      });

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      // Don't call confirmDeleteItem

      await act(async () => {
        await result.current.handleDeleteItem();
      });

      expect(plansApi.deletePlanItemFromInstance).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API error on add plan item', async () => {
      const showError = jest.fn();
      const setCollaborativePlans = jest.fn();

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: [{ _id: 'plan-123', plan: [] }],
        setCollaborativePlans,
        showError
      });

      plansApi.addPlanItemToInstance.mockRejectedValue(new Error('API Error'));
      handleError.mockReturnValue('Failed to add item');

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
        result.current.handleInputChange({ target: { name: 'text', value: 'New item' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(showError).toHaveBeenCalledWith('Failed to add item');
    });

    it('should handle API error on delete plan item', async () => {
      const showError = jest.fn();
      const setCollaborativePlans = jest.fn();
      const itemToDelete = { _id: 'item-123', text: 'Test' };

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: [{ _id: 'plan-123', plan: [itemToDelete] }],
        setCollaborativePlans,
        showError
      });

      plansApi.deletePlanItemFromInstance.mockRejectedValue(new Error('Delete failed'));
      handleError.mockReturnValue('Failed to delete item');

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.confirmDeleteItem(itemToDelete);
      });

      await act(async () => {
        await result.current.handleDeleteItem();
      });

      expect(showError).toHaveBeenCalledWith('Failed to delete item');
    });

    it('should handle API error on experience item save', async () => {
      const showError = jest.fn();
      const setExperience = jest.fn();

      const mockProps = createMockProps({
        mode: 'experience',
        experience: { _id: 'exp-123', plan_items: [] },
        setExperience,
        showError
      });

      plansApi.addExperiencePlanItem.mockRejectedValue(new Error('API Error'));
      handleError.mockReturnValue('Failed to add experience item');

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
        result.current.handleInputChange({ target: { name: 'text', value: 'Test' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      expect(showError).toHaveBeenCalledWith('Failed to add experience item');
    });
  });

  describe('Mode Switching', () => {
    it('should use plan handlers in plan mode', () => {
      const mockProps = createMockProps({ mode: 'plan' });
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const planItem = { _id: 'plan-item', plan_item_id: 'pi-123', text: 'Plan item' };

      act(() => {
        result.current.handleEditItem(planItem);
      });

      // Plan mode should include plan_item_id
      expect(result.current.editingItem.plan_item_id).toBe('pi-123');
    });

    it('should use experience handlers in experience mode', () => {
      const mockProps = createMockProps({ mode: 'experience' });
      const { result } = renderHook(() => usePlanItemManager(mockProps));

      const experienceItem = { _id: 'exp-item', text: 'Experience item', cost_estimate: 50 };

      act(() => {
        result.current.handleEditItem(experienceItem);
      });

      // Experience mode should map cost_estimate to cost
      expect(result.current.editingItem.cost).toBe(50);
      // Should not have plan_item_id
      expect(result.current.editingItem.plan_item_id).toBeUndefined();
    });
  });

  describe('Optimistic Update Rollback', () => {
    it('should rollback state on API failure for add', async () => {
      const setCollaborativePlans = jest.fn();
      const originalPlans = [{ _id: 'plan-123', plan: [] }];

      const mockProps = createMockProps({
        plan: { _id: 'plan-123' },
        collaborativePlans: originalPlans,
        setCollaborativePlans
      });

      plansApi.addPlanItemToInstance.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
        result.current.handleInputChange({ target: { name: 'text', value: 'New item' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      // Verify rollback was called with original plans
      expect(setCollaborativePlans).toHaveBeenCalledWith(originalPlans);
    });

    it('should rollback experience state on API failure', async () => {
      const setExperience = jest.fn();
      const originalExperience = { _id: 'exp-123', plan_items: [] };

      const mockProps = createMockProps({
        mode: 'experience',
        experience: originalExperience,
        setExperience
      });

      plansApi.addExperiencePlanItem.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => usePlanItemManager(mockProps));

      act(() => {
        result.current.handleAddItem();
        result.current.handleInputChange({ target: { name: 'text', value: 'New item' } });
      });

      await act(async () => {
        await result.current.handleSaveItem({ preventDefault: jest.fn() });
      });

      // Verify rollback was called
      expect(setExperience).toHaveBeenCalledWith(originalExperience);
    });
  });
});
