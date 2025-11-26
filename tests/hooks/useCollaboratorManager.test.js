/**
 * Tests for useCollaboratorManager hook
 * Tests collaborator management for experiences and plans
 */

import { renderHook, act } from '@testing-library/react-hooks';
import useCollaboratorManager from '../../src/hooks/useCollaboratorManager';
import * as experiencesApi from '../../src/utilities/experiences-api';
import * as plansApi from '../../src/utilities/plans-api';
import * as usersApi from '../../src/utilities/users-api';
import * as invitesApi from '../../src/utilities/invites-api';
import { handleError } from '../../src/utilities/error-handler';

// Mock dependencies
jest.mock('../../src/utilities/experiences-api');
jest.mock('../../src/utilities/plans-api');
jest.mock('../../src/utilities/users-api');
jest.mock('../../src/utilities/invites-api');
jest.mock('../../src/utilities/error-handler');
jest.mock('../../src/utilities/debug', () => ({
  error: jest.fn(),
  log: jest.fn()
}));
jest.mock('../../src/lang.constants', () => ({
  lang: {
    en: {
      label: {
        emailAndNameRequired: 'Email and name are required'
      },
      notification: {
        collaborator: {
          invited: 'Invite sent to {email}. They\'ll receive an email with instructions to join.'
        }
      }
    }
  }
}));

jest.mock('../../src/hooks/useOptimisticAction', () => {
  return jest.fn(({ apply, apiCall, rollback, onSuccess, onError }) => {
    return async () => {
      try {
        apply();
        await apiCall();
        if (onSuccess) await onSuccess();
      } catch (err) {
        rollback();
        if (onError) onError(err);
      }
    };
  });
});

describe('useCollaboratorManager', () => {
  const mockUser = { _id: 'current-user-123', name: 'Current User' };
  const mockCollaborator = { _id: 'collab-456', name: 'Test Collaborator', email: 'collab@test.com' };
  const mockCollaborator2 = { _id: 'collab-789', name: 'Second Collaborator', email: 'collab2@test.com' };

  const createMockProps = (overrides = {}) => ({
    experienceId: 'exp-123',
    experience: { _id: 'exp-123', title: 'Test Experience', permissions: [] },
    selectedPlanId: 'plan-456',
    userPlan: { _id: 'plan-456', permissions: [] },
    collaborativePlans: [],
    setExperience: jest.fn(),
    setUserPlan: jest.fn(),
    setCollaborativePlans: jest.fn(),
    fetchExperience: jest.fn().mockResolvedValue({}),
    fetchPlans: jest.fn().mockResolvedValue([]),
    fetchCollaborativePlans: jest.fn().mockResolvedValue([]),
    experienceCollaborators: [],
    planCollaborators: [],
    user: mockUser,
    success: jest.fn(),
    showError: jest.fn(),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    handleError.mockReturnValue('An error occurred');
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      expect(result.current.showCollaboratorModal).toBe(false);
      expect(result.current.collaboratorContext).toBe('plan');
      expect(result.current.collaboratorSearch).toBe('');
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.selectedCollaborators).toEqual([]);
      expect(result.current.existingCollaborators).toEqual([]);
      expect(result.current.removedCollaborators).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('should initialize email invite state', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      expect(result.current.showEmailInviteForm).toBe(false);
      expect(result.current.emailInviteData).toEqual({ email: '', name: '' });
      expect(result.current.emailInviteSending).toBe(false);
      expect(result.current.emailInviteError).toBe('');
    });

    it('should expose all handlers', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      expect(typeof result.current.openCollaboratorModal).toBe('function');
      expect(typeof result.current.handleSearchUsers).toBe('function');
      expect(typeof result.current.handleSelectUser).toBe('function');
      expect(typeof result.current.handleRemoveSelectedCollaborator).toBe('function');
      expect(typeof result.current.handleAddCollaborator).toBe('function');
      expect(typeof result.current.handleSendEmailInvite).toBe('function');
    });
  });

  describe('Modal Control', () => {
    it('should open modal for plan context', () => {
      const mockProps = createMockProps({
        planCollaborators: [mockCollaborator]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
      });

      expect(result.current.showCollaboratorModal).toBe(true);
      expect(result.current.collaboratorContext).toBe('plan');
      expect(result.current.selectedCollaborators).toEqual([mockCollaborator]);
      expect(result.current.existingCollaborators).toEqual([mockCollaborator]);
    });

    it('should open modal for experience context', () => {
      const mockProps = createMockProps({
        experienceCollaborators: [mockCollaborator, mockCollaborator2]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('experience');
      });

      expect(result.current.showCollaboratorModal).toBe(true);
      expect(result.current.collaboratorContext).toBe('experience');
      expect(result.current.selectedCollaborators).toHaveLength(2);
      expect(result.current.existingCollaborators).toHaveLength(2);
    });

    it('should reset removed collaborators when opening modal', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Simulate having removed collaborators
      act(() => {
        result.current.openCollaboratorModal('plan');
      });

      expect(result.current.removedCollaborators).toEqual([]);
    });

    it('should close modal via setter', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
      });
      expect(result.current.showCollaboratorModal).toBe(true);

      act(() => {
        result.current.setShowCollaboratorModal(false);
      });
      expect(result.current.showCollaboratorModal).toBe(false);
    });
  });

  describe('User Search', () => {
    it('should search users when query is at least 2 characters', async () => {
      const searchResults = [mockCollaborator, mockCollaborator2];
      usersApi.searchUsers.mockResolvedValue(searchResults);

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      await act(async () => {
        await result.current.handleSearchUsers('test');
      });

      expect(usersApi.searchUsers).toHaveBeenCalledWith('test');
      expect(result.current.searchResults).toHaveLength(2);
    });

    it('should not search when query is less than 2 characters', async () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      await act(async () => {
        await result.current.handleSearchUsers('t');
      });

      expect(usersApi.searchUsers).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual([]);
    });

    it('should clear results when query is empty', async () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      await act(async () => {
        await result.current.handleSearchUsers('');
      });

      expect(result.current.searchResults).toEqual([]);
    });

    it('should filter out current user from search results', async () => {
      const searchResults = [mockUser, mockCollaborator]; // Include current user
      usersApi.searchUsers.mockResolvedValue(searchResults);

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      await act(async () => {
        await result.current.handleSearchUsers('test');
      });

      // Should not include current user
      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0]._id).toBe(mockCollaborator._id);
    });

    it('should filter out already selected collaborators', async () => {
      const searchResults = [mockCollaborator, mockCollaborator2];
      usersApi.searchUsers.mockResolvedValue(searchResults);

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Select first collaborator
      act(() => {
        result.current.handleSelectUser(mockCollaborator);
      });

      // Search again
      await act(async () => {
        await result.current.handleSearchUsers('test');
      });

      // Should only show non-selected user
      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0]._id).toBe(mockCollaborator2._id);
    });

    it('should handle search API errors gracefully', async () => {
      usersApi.searchUsers.mockRejectedValue(new Error('Search failed'));

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      await act(async () => {
        await result.current.handleSearchUsers('test');
      });

      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe('User Selection', () => {
    it('should add user to selected collaborators', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.handleSelectUser(mockCollaborator);
      });

      expect(result.current.selectedCollaborators).toHaveLength(1);
      expect(result.current.selectedCollaborators[0]._id).toBe(mockCollaborator._id);
    });

    it('should clear search after selection', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Set search first
      act(() => {
        result.current.setCollaboratorSearch('test');
      });

      act(() => {
        result.current.handleSelectUser(mockCollaborator);
      });

      expect(result.current.collaboratorSearch).toBe('');
      expect(result.current.searchResults).toEqual([]);
    });

    it('should not add duplicate collaborators', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.handleSelectUser(mockCollaborator);
        result.current.handleSelectUser(mockCollaborator); // Duplicate
      });

      expect(result.current.selectedCollaborators).toHaveLength(1);
    });

    it('should allow selecting multiple collaborators', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.handleSelectUser(mockCollaborator);
        result.current.handleSelectUser(mockCollaborator2);
      });

      expect(result.current.selectedCollaborators).toHaveLength(2);
    });
  });

  describe('Remove Selected Collaborator', () => {
    it('should remove collaborator from selected list', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.handleSelectUser(mockCollaborator);
        result.current.handleSelectUser(mockCollaborator2);
      });
      expect(result.current.selectedCollaborators).toHaveLength(2);

      act(() => {
        result.current.handleRemoveSelectedCollaborator(mockCollaborator._id);
      });

      expect(result.current.selectedCollaborators).toHaveLength(1);
      expect(result.current.selectedCollaborators[0]._id).toBe(mockCollaborator2._id);
    });

    it('should track removed existing collaborators', () => {
      const mockProps = createMockProps({
        planCollaborators: [mockCollaborator]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Open modal to set existing collaborators
      act(() => {
        result.current.openCollaboratorModal('plan');
      });

      // Remove existing collaborator
      act(() => {
        result.current.handleRemoveSelectedCollaborator(mockCollaborator._id);
      });

      expect(result.current.removedCollaborators).toContain(mockCollaborator._id);
    });

    it('should not track newly added collaborators as removed', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
      });

      // Add new collaborator
      act(() => {
        result.current.handleSelectUser(mockCollaborator);
      });

      // Remove newly added (not existing)
      act(() => {
        result.current.handleRemoveSelectedCollaborator(mockCollaborator._id);
      });

      expect(result.current.removedCollaborators).toEqual([]);
    });
  });

  describe('Add/Remove Collaborators API', () => {
    it('should add collaborator to plan', async () => {
      plansApi.addCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] }
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Open modal and select collaborator
      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      // Add collaborator
      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(plansApi.addCollaborator).toHaveBeenCalledWith('plan-123', mockCollaborator._id);
    });

    it('should add collaborator to experience', async () => {
      experiencesApi.addExperienceCollaborator.mockResolvedValue({});

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Open modal for experience and select collaborator
      act(() => {
        result.current.openCollaboratorModal('experience');
        result.current.handleSelectUser(mockCollaborator);
      });

      // Add collaborator
      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(experiencesApi.addExperienceCollaborator).toHaveBeenCalledWith('exp-123', mockCollaborator._id);
    });

    it('should remove collaborator from plan', async () => {
      plansApi.removeCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] },
        planCollaborators: [mockCollaborator]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Open modal and remove existing collaborator
      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleRemoveSelectedCollaborator(mockCollaborator._id);
      });

      // Submit changes
      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(plansApi.removeCollaborator).toHaveBeenCalledWith('plan-123', mockCollaborator._id);
    });

    it('should remove collaborator from experience', async () => {
      experiencesApi.removeExperienceCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        experienceCollaborators: [mockCollaborator]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      // Open modal and remove existing collaborator
      act(() => {
        result.current.openCollaboratorModal('experience');
        result.current.handleRemoveSelectedCollaborator(mockCollaborator._id);
      });

      // Submit changes
      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(experiencesApi.removeExperienceCollaborator).toHaveBeenCalledWith('exp-123', mockCollaborator._id);
    });

    it('should not proceed for plan context without selected plan', async () => {
      const mockProps = createMockProps({
        selectedPlanId: null
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(plansApi.addCollaborator).not.toHaveBeenCalled();
    });

    it('should track success state after adding collaborators', async () => {
      plansApi.addCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] }
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(result.current.collaboratorAddSuccess).toBe(true);
      expect(result.current.addedCollaborators).toContain(mockCollaborator);
    });

    it('should handle API errors', async () => {
      plansApi.addCollaborator.mockRejectedValue(new Error('API Error'));

      const showError = jest.fn();
      const mockProps = createMockProps({
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] },
        showError
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(showError).toHaveBeenCalled();
    });
  });

  describe('Email Invite', () => {
    it('should show email invite form', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setShowEmailInviteForm(true);
      });

      expect(result.current.showEmailInviteForm).toBe(true);
    });

    it('should update email invite data', () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: 'test@example.com', name: 'Test User' });
      });

      expect(result.current.emailInviteData.email).toBe('test@example.com');
      expect(result.current.emailInviteData.name).toBe('Test User');
    });

    it('should validate email and name are required', async () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: '', name: '' });
      });

      await act(async () => {
        await result.current.handleSendEmailInvite({ preventDefault: jest.fn() });
      });

      expect(result.current.emailInviteError).toBe('Email and name are required');
      expect(invitesApi.sendEmailInvite).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: 'invalid-email', name: 'Test' });
      });

      await act(async () => {
        await result.current.handleSendEmailInvite({ preventDefault: jest.fn() });
      });

      expect(result.current.emailInviteError).toBe('Please enter a valid email address');
      expect(invitesApi.sendEmailInvite).not.toHaveBeenCalled();
    });

    it('should send email invite successfully', async () => {
      invitesApi.sendEmailInvite.mockResolvedValue({});
      const success = jest.fn();

      const mockProps = createMockProps({ success });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: 'test@example.com', name: 'Test User' });
        result.current.setShowEmailInviteForm(true);
      });

      await act(async () => {
        await result.current.handleSendEmailInvite({ preventDefault: jest.fn() });
      });

      expect(invitesApi.sendEmailInvite).toHaveBeenCalledWith(expect.objectContaining({
        email: 'test@example.com',
        name: 'Test User',
        resourceType: 'experience',
        resourceId: 'exp-123'
      }));
      expect(success).toHaveBeenCalled();
      expect(result.current.emailInviteData).toEqual({ email: '', name: '' });
      expect(result.current.showEmailInviteForm).toBe(false);
    });

    it('should handle email invite API errors', async () => {
      invitesApi.sendEmailInvite.mockRejectedValue(new Error('Failed to send invite'));

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: 'test@example.com', name: 'Test User' });
      });

      await act(async () => {
        await result.current.handleSendEmailInvite({ preventDefault: jest.fn() });
      });

      expect(result.current.emailInviteError).toBe('Failed to send invite');
    });

    it('should set loading state during email send', async () => {
      let resolvePromise;
      invitesApi.sendEmailInvite.mockImplementation(() => new Promise(resolve => {
        resolvePromise = resolve;
      }));

      const mockProps = createMockProps();
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.setEmailInviteData({ email: 'test@example.com', name: 'Test User' });
      });

      // Start sending
      let sendPromise;
      act(() => {
        sendPromise = result.current.handleSendEmailInvite({ preventDefault: jest.fn() });
      });

      expect(result.current.emailInviteSending).toBe(true);

      // Complete
      await act(async () => {
        resolvePromise({});
        await sendPromise;
      });

      expect(result.current.emailInviteSending).toBe(false);
    });
  });

  describe('Optimistic Updates', () => {
    it('should optimistically update experience permissions', async () => {
      const setExperience = jest.fn();
      experiencesApi.addExperienceCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        setExperience,
        experience: { _id: 'exp-123', permissions: [] }
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('experience');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      // Should have called setExperience with updated permissions
      expect(setExperience).toHaveBeenCalled();
    });

    it('should optimistically update plan permissions', async () => {
      const setUserPlan = jest.fn();
      plansApi.addCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        setUserPlan,
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] }
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(setUserPlan).toHaveBeenCalled();
    });

    it('should update collaborative plans when selected plan is not user plan', async () => {
      const setCollaborativePlans = jest.fn();
      plansApi.addCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        setCollaborativePlans,
        selectedPlanId: 'collab-plan-789',
        userPlan: { _id: 'user-plan-123', permissions: [] },
        collaborativePlans: [{ _id: 'collab-plan-789', permissions: [] }]
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(setCollaborativePlans).toHaveBeenCalled();
    });
  });

  describe('Refresh After Success', () => {
    it('should fetch experience after experience collaborator change', async () => {
      const fetchExperience = jest.fn().mockResolvedValue({});
      experiencesApi.addExperienceCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({ fetchExperience });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('experience');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(fetchExperience).toHaveBeenCalled();
    });

    it('should fetch plans after plan collaborator change', async () => {
      const fetchPlans = jest.fn().mockResolvedValue([]);
      const fetchCollaborativePlans = jest.fn().mockResolvedValue([]);
      plansApi.addCollaborator.mockResolvedValue({});

      const mockProps = createMockProps({
        selectedPlanId: 'plan-123',
        userPlan: { _id: 'plan-123', permissions: [] },
        fetchPlans,
        fetchCollaborativePlans
      });
      const { result } = renderHook(() => useCollaboratorManager(mockProps));

      act(() => {
        result.current.openCollaboratorModal('plan');
        result.current.handleSelectUser(mockCollaborator);
      });

      await act(async () => {
        await result.current.handleAddCollaborator({ preventDefault: jest.fn() });
      });

      expect(fetchCollaborativePlans).toHaveBeenCalled();
      expect(fetchPlans).toHaveBeenCalled();
    });
  });
});
