import { useState, useCallback } from 'react';
import useOptimisticAction from './useOptimisticAction';
import { handleError } from '../utilities/error-handler';
import { idEquals } from '../utilities/user-roles';
import {
  addExperienceCollaborator,
  removeExperienceCollaborator,
  addCollaborator,
  removeCollaborator,
  sendEmailInvite
} from '../utilities/experiences-api';
import { searchUsers } from '../utilities/users-service';
import { logger } from '../utilities/logger';

/**
 * Custom hook for managing collaborators with optimistic UI
 * Handles both experience and plan collaborator operations
 *
 * @param {Object} options
 * @param {Object} options.experience - Experience object
 * @param {Function} options.setExperience - Setter for experience
 * @param {Object} options.userPlan - User's plan object
 * @param {Function} options.setUserPlan - Setter for user plan
 * @param {Array} options.collaborativePlans - Collaborative plans array
 * @param {Function} options.setCollaborativePlans - Setter for collaborative plans
 * @param {string} options.selectedPlanId - Currently selected plan ID
 * @param {Function} options.fetchExperience - Fetch experience data
 * @param {Function} options.fetchCollaborativePlans - Fetch collaborative plans
 * @param {Function} options.fetchPlans - Fetch global plans
 * @param {Array} options.experienceCollaborators - Fetched experience collaborators
 * @param {Array} options.planCollaborators - Fetched plan collaborators
 * @param {Function} options.showError - Error display function
 * @param {Function} options.showSuccess - Success display function
 * @param {Object} options.user - Current user object
 * @param {string} options.experienceId - Experience ID
 */
export default function useCollaboratorManager({
  experience,
  setExperience,
  userPlan,
  setUserPlan,
  collaborativePlans,
  setCollaborativePlans,
  selectedPlanId,
  fetchExperience,
  fetchCollaborativePlans,
  fetchPlans,
  experienceCollaborators,
  planCollaborators,
  showError,
  showSuccess,
  user,
  experienceId
}) {
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [collaboratorContext, setCollaboratorContext] = useState('plan'); // 'plan' or 'experience'

  // Search state
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selection state
  const [selectedCollaborators, setSelectedCollaborators] = useState([]);
  const [existingCollaborators, setExistingCollaborators] = useState([]);
  const [removedCollaborators, setRemovedCollaborators] = useState([]);

  // Success tracking
  const [collaboratorAddSuccess, setCollaboratorAddSuccess] = useState(false);
  const [addedCollaborators, setAddedCollaborators] = useState([]);
  const [actuallyRemovedCollaborators, setActuallyRemovedCollaborators] = useState([]);

  // Email invite state
  const [showEmailInviteForm, setShowEmailInviteForm] = useState(false);
  const [emailInviteData, setEmailInviteData] = useState({ email: '', name: '' });
  const [emailInviteSending, setEmailInviteSending] = useState(false);
  const [emailInviteError, setEmailInviteError] = useState('');

  // Loading state
  const [loading, setLoading] = useState(false);

  /**
   * Open collaborator modal
   */
  const openModal = useCallback(
    (context) => {
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
      setShowModal(true);
    },
    [experienceCollaborators, planCollaborators]
  );

  /**
   * Close collaborator modal and reset state
   */
  const closeModal = useCallback(() => {
    setShowModal(false);
    setCollaboratorContext('plan');
    setCollaboratorSearch('');
    setSearchResults([]);
    setSelectedCollaborators([]);
    setExistingCollaborators([]);
    setRemovedCollaborators([]);
    setCollaboratorAddSuccess(false);
    setAddedCollaborators([]);
    setActuallyRemovedCollaborators([]);
  }, []);

  /**
   * Search for users
   */
  const handleSearchUsers = useCallback(
    async (query) => {
      setCollaboratorSearch(query);

      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const results = await searchUsers(query);

        // Filter out users that are already selected or are the current user (owner)
        const filteredResults = results.filter((result) => {
          // Don't show current user
          if (idEquals(result._id, user._id)) return false;

          // Don't show users that are already selected
          const alreadySelected = selectedCollaborators.some((collab) =>
            idEquals(collab._id, result._id)
          );

          return !alreadySelected;
        });

        setSearchResults(filteredResults);
      } catch (err) {
        logger.error('Error searching users:', err);
        setSearchResults([]);
      }
    },
    [selectedCollaborators, user]
  );

  /**
   * Select a user to add as collaborator
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
   * Remove a selected collaborator
   */
  const handleRemoveSelectedCollaborator = useCallback(
    (userId) => {
      setSelectedCollaborators((prev) =>
        prev.filter((u) => !idEquals(u._id, userId))
      );

      // If this was an existing collaborator, add to removed list
      const wasExisting = existingCollaborators.some((u) =>
        idEquals(u._id, userId)
      );
      if (wasExisting) {
        const collaborator = existingCollaborators.find((u) =>
          idEquals(u._id, userId)
        );
        setRemovedCollaborators((prev) => [...prev, collaborator]);
      }
    },
    [existingCollaborators]
  );

  /**
   * Add/remove collaborators with optimistic UI
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
          !existingCollaborators.some((existing) =>
            idEquals(existing._id, selected._id)
          )
      );

      // Snapshot previous state for rollback
      const prevExperience = experience ? { ...experience } : null;
      const prevUserPlan = userPlan ? { ...userPlan } : null;
      const prevCollaborativePlans = collaborativePlans
        ? collaborativePlans.map((p) => ({ ...p }))
        : [];

      const apply = () => {
        // Optimistically update permissions arrays so collaborator chips update immediately
        if (isExperienceContext) {
          setExperience((prev) => {
            if (!prev) return prev;
            const toRemoveIds = new Set(
              removedCollaborators.map((c) => c._id)
            );
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
              granted_at: new Date().toISOString(),
            }));
            return { ...prev, permissions: [...withoutRemoved, ...addedPerms] };
          });
        } else {
          // Update selected plan's permissions (could be userPlan or a collaborative plan)
          const applyToPlan = (plan) => {
            if (!plan) return plan;
            const toRemoveIds = new Set(
              removedCollaborators.map((c) => c._id)
            );
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
              granted_at: new Date().toISOString(),
            }));
            return { ...plan, permissions: [...withoutRemoved, ...addedPerms] };
          };

          if (userPlan && idEquals(userPlan._id, selectedPlanId)) {
            setUserPlan((prev) => applyToPlan(prev));
          } else {
            setCollaborativePlans((prev) =>
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
          if (prevCollaborativePlans?.length) {
            setCollaborativePlans(prevCollaborativePlans);
          }
        }
      };

      const apiCall = async () => {
        // Perform removals first, then additions
        for (const collaborator of removedCollaborators) {
          try {
            if (isExperienceContext) {
              await removeExperienceCollaborator(experienceId, collaborator._id);
            } else {
              await removeCollaborator(selectedPlanId, collaborator._id);
            }
          } catch (err) {
            logger.error(`Error removing collaborator ${collaborator.name}:`, err);
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
            logger.error(`Error adding collaborator ${collaborator.name}:`, err);
            throw err;
          }
        }
      };

      const onSuccess = async () => {
        try {
          if (isExperienceContext) {
            await fetchExperience();
          } else {
            await fetchCollaborativePlans();
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
        context: 'Manage collaborators',
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
      fetchCollaborativePlans,
      fetchExperience,
      userPlan,
      collaborativePlans,
      fetchPlans,
      experience,
      setExperience,
      setUserPlan,
      setCollaborativePlans,
      showError
    ]
  );

  /**
   * Send email invite to non-user
   */
  const handleSendEmailInvite = useCallback(
    async (e) => {
      e.preventDefault();

      // Validation
      if (!emailInviteData.email.trim() || !emailInviteData.name.trim()) {
        setEmailInviteError('Email and name are required');
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
          permissionType: 'collaborator',
        });

        // Show success
        showSuccess(`Email invite sent successfully to ${emailInviteData.email}!`);

        // Reset form
        setEmailInviteData({ email: '', name: '' });
        setShowEmailInviteForm(false);
      } catch (error) {
        setEmailInviteError(error.message || 'Failed to send email invite');
      } finally {
        setEmailInviteSending(false);
      }
    },
    [emailInviteData, experienceId, experience, showSuccess]
  );

  /**
   * Handle email invite form input changes
   */
  const handleEmailInviteChange = useCallback((e) => {
    const { name, value } = e.target;
    setEmailInviteData((prev) => ({ ...prev, [name]: value }));
  }, []);

  /**
   * Toggle email invite form visibility
   */
  const toggleEmailInviteForm = useCallback(() => {
    setShowEmailInviteForm((prev) => !prev);
    setEmailInviteError('');
    setEmailInviteData({ email: '', name: '' });
  }, []);

  return {
    // Modal state
    showModal,
    collaboratorContext,

    // Search state
    collaboratorSearch,
    searchResults,

    // Selection state
    selectedCollaborators,
    existingCollaborators,
    removedCollaborators,

    // Success state
    collaboratorAddSuccess,
    addedCollaborators,
    actuallyRemovedCollaborators,

    // Email invite state
    showEmailInviteForm,
    emailInviteData,
    emailInviteSending,
    emailInviteError,

    // Loading state
    loading,

    // Handlers
    openModal,
    closeModal,
    handleSearchUsers,
    handleSelectUser,
    handleRemoveSelectedCollaborator,
    handleAddCollaborator,
    handleSendEmailInvite,
    handleEmailInviteChange,
    toggleEmailInviteForm,

    // Setters (for form control)
    setCollaboratorSearch,
    setSearchResults
  };
}
