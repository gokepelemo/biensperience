/**
 * useCollaboratorManager Hook
 * Manages collaborator operations for experiences and plans
 *
 * Features:
 * - Search and selection UI state
 * - Email invite form state and validation
 * - Add/remove collaborators with optimistic updates
 * - Permission display
 * - Real-time collaborator presence (WebSocket ready)
 *
 * @param {Object} params
 * @param {string} params.experienceId - Experience ID
 * @param {Object} params.experience - Experience object
 * @param {string} params.selectedPlanId - Selected plan ID
 * @param {Object} params.userPlan - User's plan object
 * @param {Array} params.sharedPlans - All shared plans
 * @param {Function} params.setExperience - Update experience state
 * @param {Function} params.setUserPlan - Update user plan state
 * @param {Function} params.setSharedPlans - Update shared plans state
 * @param {Function} params.fetchExperience - Fetch experience data
 * @param {Function} params.fetchPlans - Fetch user's plans
 * @param {Function} params.fetchSharedPlans - Fetch shared plans
 * @param {Array} params.experienceCollaborators - Experience collaborators with user data
 * @param {Array} params.planCollaborators - Plan collaborators with user data
 * @param {Object} params.user - Current user object
 * @param {Function} params.success - Toast success callback
 * @param {Function} params.showError - Toast error callback
 */

import { useState, useCallback } from 'react';
import {
  addExperienceCollaborator,
  removeExperienceCollaborator,
  getExperiencePermissions
} from '../utilities/experiences-api';
import {
  addCollaborator,
  removeCollaborator
} from '../utilities/plans-api';
import { getDestinationPermissions } from '../utilities/destinations-api';
import { searchUsers, searchOwnedEntities } from '../utilities/users-api';
import { getBulkUserData } from '../utilities/users-api';
import { sendEmailInvite } from '../utilities/invites-api';
import { handleError } from '../utilities/error-handler';
import useOptimisticAction from './useOptimisticAction';
import debug from '../utilities/debug';
import { lang } from '../lang.constants';
import { idEquals } from '../utilities/id-utils';

export default function useCollaboratorManager({
  experienceId,
  experience,
  selectedPlanId,
  userPlan,
  sharedPlans,
  setExperience,
  setUserPlan,
  setSharedPlans,
  fetchExperience,
  fetchPlans,
  fetchSharedPlans,
  experienceCollaborators,
  planCollaborators,
  user,
  success,
  showError
}) {
  // Modal and context state
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [collaboratorContext, setCollaboratorContext] = useState('plan'); // 'plan' or 'experience'

  // Search state
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selection state
  const [selectedCollaborators, setSelectedCollaborators] = useState([]); // Multiple selected collaborators
  const [existingCollaborators, setExistingCollaborators] = useState([]); // Existing collaborators when modal opens
  const [removedCollaborators, setRemovedCollaborators] = useState([]); // Collaborators marked for removal

  // Success tracking
  const [collaboratorAddSuccess, setCollaboratorAddSuccess] = useState(false);
  const [addedCollaborators, setAddedCollaborators] = useState([]); // Track multiple additions
  const [actuallyRemovedCollaborators, setActuallyRemovedCollaborators] = useState([]); // Track removals

  // Email invite state
  const [showEmailInviteForm, setShowEmailInviteForm] = useState(false); // Toggle email invite form
  const [emailInviteData, setEmailInviteData] = useState({
    email: '',
    name: ''
  });
  const [emailInviteSending, setEmailInviteSending] = useState(false); // Email sending state
  const [emailInviteError, setEmailInviteError] = useState(''); // Email invite errors

  // Entity import state
  const [entityImportMessage, setEntityImportMessage] = useState(''); // Success message after entity import
  const [entityImportLoading, setEntityImportLoading] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  /**
   * Reset all transient modal state so reopening starts clean.
   * This prevents stale success/removal state from triggering auto-close timers.
   */
  const resetCollaboratorModalState = useCallback(() => {
    setCollaboratorSearch('');
    setSearchResults([]);

    setSelectedCollaborators([]);
    setExistingCollaborators([]);
    setRemovedCollaborators([]);

    setCollaboratorAddSuccess(false);
    setAddedCollaborators([]);
    setActuallyRemovedCollaborators([]);

    setShowEmailInviteForm(false);
    setEmailInviteData({ email: '', name: '' });
    setEmailInviteSending(false);
    setEmailInviteError('');

    setEntityImportMessage('');
    setEntityImportLoading(false);

    setLoading(false);
  }, []);

  /**
   * Close collaborator modal and reset all transient state.
   */
  const closeCollaboratorModal = useCallback(() => {
    setShowCollaboratorModal(false);
    resetCollaboratorModalState();
  }, [resetCollaboratorModalState]);

  /**
   * Open collaborator modal for experience or plan
   */
  const openCollaboratorModal = useCallback(
    (context) => {
      // Ensure a clean slate when opening
      resetCollaboratorModalState();
      setCollaboratorContext(context);

      // Get existing collaborators based on context - use the fetched user data
      let existing = [];
      if (context === 'experience') {
        existing = experienceCollaborators || [];
      } else {
        existing = planCollaborators || [];
      }

      setExistingCollaborators(existing);
      setSelectedCollaborators(existing);
      setRemovedCollaborators([]);
      setShowCollaboratorModal(true);
    },
    [experienceCollaborators, planCollaborators, resetCollaboratorModalState]
  );

  /**
   * Search users AND owned experiences/destinations for collaborator selection
   */
  const handleSearchUsers = useCallback(
    async (query) => {
      setCollaboratorSearch(query);

      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const [userResults, entityResults] = await Promise.all([
          searchUsers(query),
          searchOwnedEntities(query)
        ]);

        // Filter out users already selected or the current user
        const filteredUsers = (userResults || []).filter((result) => {
          if (idEquals(result._id, user._id)) return false;
          return !selectedCollaborators.some((collab) => idEquals(collab._id, result._id));
        });

        // Entity results are appended after users with their type tags intact
        const combined = [
          ...filteredUsers,
          ...(entityResults || [])
        ];

        setSearchResults(combined);
      } catch (err) {
        debug.error('Error searching users/entities:', err);
        setSearchResults([]);
      }
    },
    [selectedCollaborators, user]
  );

  /**
   * Handle selection of an owned experience or destination:
   * fetch its collaborators and add them to the staged selection.
   */
  const handleSelectEntity = useCallback(
    async (entity) => {
      setEntityImportLoading(true);
      setEntityImportMessage('');

      try {
        let directPermissions = [];
        if (entity.type === 'experience') {
          const data = await getExperiencePermissions(entity._id);
          directPermissions = data?.directPermissions || [];
        } else if (entity.type === 'destination') {
          const data = await getDestinationPermissions(entity._id);
          directPermissions = data?.directPermissions || [];
        }

        // Extract user-type non-owner entries
        const userPerms = directPermissions.filter(
          (p) => p.entity === 'user' && p.type !== 'owner'
        );

        if (userPerms.length === 0) {
          setEntityImportMessage(`"${entity.name}" has no collaborators to import.`);
          return;
        }

        // Fetch full user data for name/email display
        const userIds = userPerms.map((p) => p._id.toString());
        const userData = await getBulkUserData(userIds);

        // Add users not already selected and not the current user
        const newUsers = (userData || []).filter(
          (u) =>
            u &&
            !idEquals(u._id, user._id) &&
            !selectedCollaborators.some((c) => idEquals(c._id, u._id))
        );

        if (newUsers.length > 0) {
          setSelectedCollaborators((prev) => [...prev, ...newUsers]);
        }

        const importedCount = newUsers.length;
        const skippedCount = userPerms.length - importedCount;
        if (importedCount > 0) {
          const skippedNote = skippedCount > 0 ? ` (${skippedCount} already added)` : '';
          setEntityImportMessage(
            `Imported ${importedCount} collaborator${importedCount !== 1 ? 's' : ''} from "${entity.name}"${skippedNote}.`
          );
        } else {
          setEntityImportMessage(
            `All collaborators from "${entity.name}" are already added.`
          );
        }
      } catch (err) {
        debug.error('Error importing entity collaborators:', err);
        setEntityImportMessage('Failed to import collaborators. Please try again.');
      } finally {
        setEntityImportLoading(false);
        setCollaboratorSearch('');
        setSearchResults([]);
      }
    },
    [selectedCollaborators, user]
  );

  /**
   * Select a user as a collaborator
   */
  const handleSelectUser = useCallback((user) => {
    // Add to selected collaborators if not already selected
    setSelectedCollaborators((prev) => {
      if (prev.some((u) => idEquals(u._id, user._id))) {
        return prev; // Already selected
      }
      return [...prev, user];
    });

    // Clear search
    setCollaboratorSearch('');
    setSearchResults([]);
  }, []);

  /**
   * Remove selected collaborator
   */
  const handleRemoveSelectedCollaborator = useCallback(
    (userId) => {
      setSelectedCollaborators((prev) =>
        prev.filter((u) => !idEquals(u._id, userId))
      );

      // If this was an existing collaborator, add their ID to removed list
      const wasExisting = existingCollaborators.some((u) =>
        idEquals(u._id, userId)
      );
      if (wasExisting) {
        setRemovedCollaborators((prev) => [...prev, userId]);
      }
    },
    [existingCollaborators]
  );

  /**
   * Add/remove collaborators with optimistic updates
   */
  const handleAddCollaborator = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);

      // Determine which entity to add/remove collaborators
      const isExperienceContext = collaboratorContext === 'experience';
      if (!isExperienceContext && !selectedPlanId) {
        setLoading(false);
        return;
      }

      // Compute additions vs existing
      const collaboratorsToAdd = selectedCollaborators.filter(
        (selected) =>
          !existingCollaborators.some(
            (existing) => existing._id === selected._id
          )
      );

      // Snapshot previous state for rollback
      const prevExperience = experience ? { ...experience } : null;
      const prevUserPlan = userPlan ? { ...userPlan } : null;
      const prevSharedPlans = sharedPlans
        ? sharedPlans.map((p) => ({ ...p }))
        : [];

      const apply = () => {
        // Optimistically update permissions arrays so collaborator chips update immediately
        if (isExperienceContext) {
          setExperience((prev) => {
            if (!prev) return prev;
            const toRemoveIds = new Set(removedCollaborators);
            const withoutRemoved = (prev.permissions || []).filter(
              (p) =>
                !(
                  p.entity === 'user' &&
                  p.type === 'collaborator' &&
                  toRemoveIds.has(p._id)
                )
            );
            const addedPerms = collaboratorsToAdd.map((c) => ({
              _id: c._id,
              entity: 'user',
              type: 'collaborator',
              granted_at: new Date().toISOString()
            }));
            return { ...prev, permissions: [...withoutRemoved, ...addedPerms] };
          });
        } else {
          // Update selected plan's permissions (could be userPlan or a collaborative plan)
          const applyToPlan = (plan) => {
            if (!plan) return plan;
            const toRemoveIds = new Set(removedCollaborators);
            const withoutRemoved = (plan.permissions || []).filter(
              (p) =>
                !(
                  p.entity === 'user' &&
                  p.type === 'collaborator' &&
                  toRemoveIds.has(p._id)
                )
            );
            const addedPerms = collaboratorsToAdd.map((c) => ({
              _id: c._id,
              entity: 'user',
              type: 'collaborator',
              granted_at: new Date().toISOString()
            }));
            return { ...plan, permissions: [...withoutRemoved, ...addedPerms] };
          };

          if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
            setUserPlan((prev) => applyToPlan(prev));
          } else {
            setSharedPlans((prev) =>
              prev.map((p) =>
                idEquals(p._id, selectedPlanId) ? applyToPlan(p) : p
              )
            );
          }
        }
      };

      const rollback = () => {
        if (isExperienceContext) {
          setExperience(prevExperience);
        } else {
          // Restore both possible containers
          if (prevUserPlan && idEquals(prevUserPlan._id, selectedPlanId)) {
            setUserPlan(prevUserPlan);
          }
          if (prevSharedPlans?.length) {
            setSharedPlans(prevSharedPlans);
          }
        }
      };

      const apiCall = async () => {
        // Perform removals first, then additions
        for (const collaboratorId of removedCollaborators) {
          try {
            if (isExperienceContext) {
              await removeExperienceCollaborator(experienceId, collaboratorId);
            } else {
              await removeCollaborator(selectedPlanId, collaboratorId);
            }
          } catch (err) {
            debug.error(
              `Error removing collaborator ${collaboratorId}:`,
              err
            );
            throw err;
          }
        }

        for (const collaborator of collaboratorsToAdd) {
          try {
            if (isExperienceContext) {
              await addExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await addCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            debug.error(`Error adding collaborator ${collaborator.name}:`, err);
            throw err;
          }
        }
      };

      const onSuccess = async () => {
        try {
          if (isExperienceContext) {
            await fetchExperience();
          } else {
            await fetchSharedPlans();
            await fetchPlans();
          }
          // Track the added and removed collaborators for success message
          setAddedCollaborators(collaboratorsToAdd);
          setActuallyRemovedCollaborators(removedCollaborators);
          setCollaboratorAddSuccess(true);
        } finally {
          setLoading(false);
        }
      };

      const onError = (err) => {
        const errorMsg = handleError(err, { context: 'Manage collaborators' });
        showError(errorMsg);
        setLoading(false);
      };

      const run = useOptimisticAction({
        apply,
        apiCall,
        rollback,
        onSuccess,
        onError,
        context: 'Manage collaborators'
      });
      await run();
    },
    [
      selectedCollaborators,
      existingCollaborators,
      removedCollaborators,
      selectedPlanId,
      collaboratorContext,
      experienceId,
      fetchSharedPlans,
      fetchExperience,
      userPlan,
      sharedPlans,
      fetchPlans,
      experience,
      setExperience,
      setUserPlan,
      setSharedPlans,
      showError
    ]
  );

  /**
   * Send email invite to non-user collaborator
   */
  const handleSendEmailInvite = useCallback(
    async (e) => {
      e.preventDefault();

      // Validation
      if (!emailInviteData.email.trim() || !emailInviteData.name.trim()) {
        setEmailInviteError(lang.current.label.emailAndNameRequired);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInviteData.email)) {
        setEmailInviteError('Please enter a valid email address');
        return;
      }

      setEmailInviteSending(true);
      setEmailInviteError('');

      try {
        await sendEmailInvite({
          email: emailInviteData.email,
          name: emailInviteData.name,
          resourceType: 'experience',
          resourceId: experienceId,
          resourceName: experience?.title || 'this experience',
          customMessage: `Join me in planning ${
            experience?.title || 'this experience'
          }!`,
          permissionType: 'collaborator'
        });

        // Show success
        const message = lang.current.notification?.collaborator?.invited?.replace('{email}', emailInviteData.email) || `Invite sent to ${emailInviteData.email}. They'll receive an email with instructions to join.`;
        success(message);

        // Reset form
        setEmailInviteData({ email: '', name: '' });
        setShowEmailInviteForm(false);
      } catch (error) {
        setEmailInviteError(error.message || 'Failed to send email invite');
      } finally {
        setEmailInviteSending(false);
      }
    },
    [emailInviteData, experienceId, experience, success]
  );

  return {
    // Modal state
    showCollaboratorModal,
    setShowCollaboratorModal,
    collaboratorContext,
    setCollaboratorContext,

    // Search state
    collaboratorSearch,
    setCollaboratorSearch,
    searchResults,

    // Selection state
    selectedCollaborators,
    setSelectedCollaborators,
    existingCollaborators,
    removedCollaborators,

    // Success tracking
    collaboratorAddSuccess,
    setCollaboratorAddSuccess,
    addedCollaborators,
    actuallyRemovedCollaborators,

    // Email invite state
    showEmailInviteForm,
    setShowEmailInviteForm,
    emailInviteData,
    setEmailInviteData,
    emailInviteSending,
    emailInviteError,

    // Entity import state
    entityImportMessage,
    setEntityImportMessage,
    entityImportLoading,

    // Loading state
    loading,
    setLoading,

    // Handlers
    openCollaboratorModal,
    closeCollaboratorModal,
    resetCollaboratorModalState,
    handleSearchUsers,
    handleSelectUser,
    handleSelectEntity,
    handleRemoveSelectedCollaborator,
    handleAddCollaborator,
    handleSendEmailInvite
  };
}
