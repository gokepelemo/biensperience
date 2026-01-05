/**
 * Regression tests for SingleExperience deep-link hash handling and scroll stability.
 *
 * Covers:
 * - Direct URL navigation: /experiences/:id#plan-{planId}-item-{itemId} selects plan and opens details.
 * - Item-level hashes are preserved (no hash rewrite) when already targeting selected plan.
 * - Toggling completion does not rewrite hash or trigger scroll.
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import SingleExperience from '../../src/views/SingleExperience/SingleExperience';
import { useUser } from '../../src/contexts/UserContext';
import { useData } from '../../src/contexts/DataContext';
import { useApp } from '../../src/contexts/AppContext';
import { useToast } from '../../src/contexts/ToastContext';
import usePlanManagement from '../../src/hooks/usePlanManagement';
import usePlanCosts from '../../src/hooks/usePlanCosts';
import { usePresence } from '../../src/hooks/usePresence';
import { useNavigationIntent } from '../../src/contexts/NavigationIntentContext';
import { useScrollHighlight } from '../../src/hooks/useScrollHighlight';
import { useModalManager } from '../../src/hooks/useModalManager';
import useCollaboratorManager from '../../src/hooks/useCollaboratorManager';
import usePlanSync from '../../src/hooks/usePlanSync';
import { useExperienceActions } from '../../src/hooks/useExperienceActions';
import { usePlanItemNotes } from '../../src/hooks/usePlanItemNotes';
import { useDateManagement } from '../../src/hooks/useDateManagement';
import useOptimisticAction from '../../src/hooks/useOptimisticAction';
import { showExperienceWithContext } from '../../src/utilities/experiences-api';
import { updatePlanItem } from '../../src/utilities/plans-api';

// -----------------
// Module mocks
// -----------------

jest.mock('../../src/contexts/UserContext', () => ({ useUser: jest.fn() }));
jest.mock('../../src/contexts/DataContext', () => ({ useData: jest.fn() }));
jest.mock('../../src/contexts/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('../../src/contexts/ToastContext', () => ({ useToast: jest.fn() }));

jest.mock('../../src/hooks/usePlanManagement', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/hooks/usePlanCosts', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/hooks/usePresence', () => ({ usePresence: jest.fn() }));
jest.mock('../../src/contexts/NavigationIntentContext', () => ({
  useNavigationIntent: jest.fn(),
  INTENT_TYPES: { HASH_NAVIGATION: 'HASH_NAVIGATION' }
}));
jest.mock('../../src/hooks/useScrollHighlight', () => ({ useScrollHighlight: jest.fn() }));

jest.mock('../../src/hooks/useCollaboratorUsers', () => ({
  useCollaboratorUsers: () => ({ users: [], loading: false })
}));

jest.mock('../../src/hooks/useCollaboratorManager', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/hooks/usePlanSync', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../src/hooks/useExperienceActions', () => ({ useExperienceActions: jest.fn() }));
jest.mock('../../src/hooks/usePlanItemNotes', () => ({ usePlanItemNotes: jest.fn() }));
jest.mock('../../src/hooks/useDateManagement', () => ({ useDateManagement: jest.fn() }));
jest.mock('../../src/hooks/useOptimisticAction', () => ({ __esModule: true, default: jest.fn() }));

jest.mock('../../src/utilities/experiences-api', () => ({
  showExperienceWithContext: jest.fn(),
  showExperienceWithContextLegacy: jest.fn()
}));
jest.mock('../../src/utilities/plans-api', () => ({
  updatePlanItem: jest.fn(),
  getUserPlans: jest.fn(),
  getExperiencePlans: jest.fn(),
  requestPlanAccess: jest.fn(),
  addPlanItem: jest.fn(),
  deletePlanItem: jest.fn(),
  removeCollaborator: jest.fn(),
  addCollaborator: jest.fn(),
  reorderPlanItems: jest.fn(),
  assignPlanItem: jest.fn(),
  unassignPlanItem: jest.fn(),
  addPlanItemDetail: jest.fn()
}));

// Keep MODAL_NAMES constants from real module, but mock the hook implementation.
jest.mock('../../src/hooks/useModalManager', () => {
  const actual = jest.requireActual('../../src/hooks/useModalManager');
  return { ...actual, useModalManager: jest.fn() };
});

// UI-heavy subcomponents: render minimal placeholders.
jest.mock('../../src/views/SingleExperience/components/ActionButtonsRow', () => () => <div data-testid="action-buttons" />);
jest.mock('../../src/views/SingleExperience/components/DatePickerSection', () => () => <div data-testid="date-picker" />);
jest.mock('../../src/views/SingleExperience/components/ExperienceOverviewSection', () => () => <div data-testid="experience-overview" />);
jest.mock('../../src/views/SingleExperience/components/PlanTabsNavigation', () => () => <div data-testid="plan-tabs" />);
jest.mock('../../src/views/SingleExperience/components/ExperienceTabContent', () => () => <div data-testid="experience-tab" />);

jest.mock('../../src/views/SingleExperience/components/MyPlanTabContent', () => (props) => {
  return (
    <div data-testid="my-plan-tab">
      <button
        type="button"
        onClick={() => props.handlePlanItemToggleComplete({ _id: 'item-1', complete: false })}
      >
        Toggle Complete
      </button>
    </div>
  );
});

jest.mock('../../src/views/SingleExperience/components/CollaboratorModal', () => () => null);
jest.mock('../../src/views/SingleExperience/components/SyncPlanModal', () => () => null);
jest.mock('../../src/views/SingleExperience/components/PlanItemModal', () => () => null);
jest.mock('../../src/views/SingleExperience/components/SingleExperienceSkeleton', () => () => <div data-testid="skeleton" />);

jest.mock('../../src/components/PlanItemDetailsModal/PlanItemDetailsModal', () => (props) => {
  if (!props.show) return null;
  return (
    <div data-testid="plan-item-details-modal">
      <div data-testid="plan-item-details-modal-item">{props.planItem?._id}</div>
    </div>
  );
});

// Router hooks: keep BrowserRouter for Link context but stub navigate/params.
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ experienceId: 'exp123' })
}));

// -----------------
// Test data
// -----------------

const mockUser = {
  _id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user'
};

const mockExperience = {
  _id: 'exp123',
  name: 'Test Experience',
  destination: { _id: 'dest-1', name: 'Paris' },
  plan_items: [],
  permissions: [{ entity: 'user', type: 'owner', _id: 'user-1' }],
  photos: []
};

const mockUserPlan = {
  _id: 'plan-1',
  user: { _id: 'user-1', name: 'Test User' },
  experience: 'exp123',
  planned_date: null,
  permissions: [{ entity: 'user', type: 'owner', _id: 'user-1' }],
  plan: [
    { _id: 'item-1', text: 'Item One', complete: false },
    { _id: 'item-2', text: 'Item Two', complete: false }
  ]
};

// -----------------
// Helpers
// -----------------

function renderSingleExperience() {
  return render(
    <BrowserRouter>
      <SingleExperience />
    </BrowserRouter>
  );
}

describe('SingleExperience deep-link + scroll stability', () => {
  let replaceStateSpy;
  let scrollToItem;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure the component believes it's on the correct route.
    window.history.pushState({}, '', '/experiences/exp123');

    // Spy on replaceState for hash rewrite assertions.
    replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    // Provide requestAnimationFrame for fallback hash handler.
    global.requestAnimationFrame = (cb) => cb();

    // Context mocks
    useUser.mockReturnValue({ user: mockUser });
    useData.mockReturnValue({
      removeExperience: jest.fn(),
      fetchExperiences: jest.fn(),
      fetchPlans: jest.fn(),
      experiences: [mockExperience],
      updateExperience: jest.fn(),
      setOptimisticPlanStateForExperience: jest.fn(),
      clearOptimisticPlanStateForExperience: jest.fn()
    });
    useApp.mockReturnValue({ registerH1: jest.fn(), updateShowH1InNavbar: jest.fn() });
    useToast.mockReturnValue({ success: jest.fn(), error: jest.fn() });

    // Plan management: use real state inside mock to allow effects to drive updates.
    usePlanManagement.mockImplementation(() => {
      const [userPlan, setUserPlan] = React.useState(mockUserPlan);
      const [sharedPlans, setSharedPlans] = React.useState([]);
      const [selectedPlanId, setSelectedPlanId] = React.useState(null);
      const [plansLoading, setPlansLoading] = React.useState(false);

      return {
        userPlan,
        setUserPlan,
        sharedPlans,
        setSharedPlans,
        selectedPlanId,
        setSelectedPlanId,
        selectedPlan: userPlan,
        plansLoading,
        setPlansLoading,
        plannedDate: null,
        setPlannedDate: jest.fn(),
        userPlannedDate: null,
        setUserPlannedDate: jest.fn(),
        displayedPlannedDate: null,
        setDisplayedPlannedDate: jest.fn(),
        userHasExperience: true,
        setUserHasExperience: jest.fn(),
        fetchUserPlan: jest.fn(),
        fetchSharedPlans: jest.fn(),
        createPlan: jest.fn(),
        updatePlan: jest.fn(),
        deletePlan: jest.fn()
      };
    });

    usePlanCosts.mockReturnValue({
      costs: [],
      costSummary: null,
      loading: false,
      addCost: jest.fn(),
      updateCost: jest.fn(),
      deleteCost: jest.fn(),
      fetchCosts: jest.fn()
    });

    usePresence.mockReturnValue({
      isConnected: false,
      experienceMembers: [],
      planMembers: [],
      setTyping: jest.fn(),
      setTab: jest.fn(),
      subscribe: jest.fn()
    });

    useNavigationIntent.mockReturnValue({ intent: null, consumeIntent: jest.fn(), clearIntent: jest.fn() });

    scrollToItem = jest.fn();
    useScrollHighlight.mockReturnValue({ scrollToItem, applyHighlight: jest.fn(), clearHighlight: jest.fn() });

    // Modal manager: lightweight stateful mock.
    useModalManager.mockImplementation(() => {
      const [activeModal, setActiveModal] = React.useState(null);

      return {
        activeModal,
        openModal: (name) => setActiveModal(name),
        closeModal: () => setActiveModal(null),
        isModalOpen: (name) => activeModal === name,
        MODAL_NAMES: jest.requireActual('../../src/hooks/useModalManager').MODAL_NAMES
      };
    });

    useCollaboratorManager.mockReturnValue({
      openCollaboratorModal: jest.fn(),
      closeCollaboratorModal: jest.fn(),
      setCollaboratorSearch: jest.fn(),
      setSelectedCollaborators: jest.fn(),
      handleSelectUser: jest.fn(),
      saveCollaborators: jest.fn(),
      collaboratorContext: 'plan',
      collaboratorSearch: '',
      searchResults: [],
      selectedCollaborators: [],
      removedCollaborators: [],
      collaboratorAddSuccess: false,
      addedCollaborators: [],
      actuallyRemovedCollaborators: []
    });

    usePlanSync.mockReturnValue({
      showSyncButton: false,
      showSyncAlert: false,
      showSyncModal: false,
      syncChanges: [],
      selectedSyncItems: [],
      syncLoading: false,
      setSelectedSyncItems: jest.fn(),
      handleSyncPlan: jest.fn(),
      confirmSyncPlan: jest.fn(),
      dismissSyncAlert: jest.fn(),
      closeSyncModal: jest.fn(),
      resetSyncState: jest.fn(),
      checkPlanDivergence: jest.fn()
    });

    useExperienceActions.mockReturnValue({
      handleExperience: jest.fn(),
      handleShareExperience: jest.fn(),
      handleSharePlanItem: jest.fn(),
      confirmRemoveExperience: jest.fn()
    });

    usePlanItemNotes.mockReturnValue({
      handleAddNote: jest.fn(),
      handleUpdateNote: jest.fn(),
      handleDeleteNote: jest.fn()
    });

    useDateManagement.mockReturnValue({
      setIsEditingDate: jest.fn(),
      plannedDateRef: { current: null }
    });

    // Optimistic action runner: call apply then apiCall, rollback on error.
    useOptimisticAction.mockImplementation(({ apply, apiCall, rollback, onError }) => {
      return async () => {
        try {
          if (apply) apply();
          if (apiCall) await apiCall();
        } catch (e) {
          if (rollback) rollback();
          if (onError) onError(e, 'Optimistic action failed');
        }
      };
    });

    showExperienceWithContext.mockResolvedValue({
      experience: mockExperience,
      userPlan: mockUserPlan,
      sharedPlans: []
    });

    updatePlanItem.mockResolvedValue({});
  });

  afterEach(() => {
    if (replaceStateSpy) replaceStateSpy.mockRestore();
    jest.useRealTimers();
  });

  it('loads #plan-{planId}-item-{itemId}, selects plan, and opens details modal', async () => {
    jest.useFakeTimers();

    window.history.pushState({}, '', '/experiences/exp123#plan-plan-1-item-item-1');

    renderSingleExperience();

    // Fetch resolves and then fallback hash handler schedules modal open after 100ms.
    await waitFor(() => {
      expect(showExperienceWithContext).toHaveBeenCalledWith('exp123');
    });

    await act(async () => {
      jest.advanceTimersByTime(150);
    });

    expect(scrollToItem).toHaveBeenCalledWith('item-1', { shouldHighlight: true });
    expect(screen.getByTestId('plan-item-details-modal')).toBeInTheDocument();
    expect(screen.getByTestId('plan-item-details-modal-item')).toHaveTextContent('item-1');
  });

  it('does not rewrite item-level hash when it already targets the selected plan', async () => {
    jest.useFakeTimers();

    window.history.pushState({}, '', '/experiences/exp123#plan-plan-1-item-item-1');

    renderSingleExperience();

    await waitFor(() => {
      expect(showExperienceWithContext).toHaveBeenCalled();
    });

    // Let scheduled hash-handler work complete.
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    // If item hash is already correct, URL writer should not call replaceState.
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('toggling completion does not rewrite hash or trigger scroll', async () => {
    jest.useFakeTimers();

    window.history.pushState({}, '', '/experiences/exp123#plan-plan-1');

    renderSingleExperience();

    await waitFor(() => {
      expect(showExperienceWithContext).toHaveBeenCalled();
    });

    const replaceCallsBefore = replaceStateSpy.mock.calls.length;

    await act(async () => {
      screen.getByRole('button', { name: /toggle complete/i }).click();
    });

    // Completion API should be called.
    expect(updatePlanItem).toHaveBeenCalledWith('plan-1', 'item-1', { complete: true });

    // No scroll or hash writes triggered by completion.
    expect(scrollToItem).not.toHaveBeenCalled();
    expect(replaceStateSpy.mock.calls.length).toBe(replaceCallsBefore);
  });
});
