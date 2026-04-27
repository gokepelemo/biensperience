/**
 * useExperienceMentions Hook
 *
 * Builds `availableEntities` and `entityData` for mention-style UI components
 * (e.g., InteractiveTextArea) in the SingleExperience view. Aggregates plan
 * collaborators (with the owner first), plan items, the current destination,
 * and the experience itself.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceMentions
 */

import { useMemo } from 'react';

export default function useExperienceMentions({
  planOwner,
  planCollaborators,
  selectedPlan,
  experience,
}) {
  // Combine plan owner and collaborators for assignments and mentions
  const allPlanCollaborators = useMemo(() => {
    const collaboratorsList = [];

    if (planOwner) {
      collaboratorsList.push(planOwner);
    }

    if (planCollaborators && planCollaborators.length > 0) {
      planCollaborators.forEach(collab => {
        const collabId = collab._id || collab.user?._id;
        const ownerId = planOwner?._id;
        if (collabId !== ownerId) {
          collaboratorsList.push(collab);
        }
      });
    }

    return collaboratorsList;
  }, [planOwner, planCollaborators]);

  // Prepare mention entities and data for InteractiveTextArea
  const availableEntities = useMemo(() => {
    const entities = [];

    if (allPlanCollaborators && allPlanCollaborators.length > 0) {
      allPlanCollaborators.forEach(user => {
        const userData = user.user || user;
        const userId = userData._id || user._id;
        const userName = userData.name || userData.email?.split('@')[0] || 'Unknown User';

        if (userId) {
          entities.push({
            type: 'user',
            id: userId,
            displayName: userName
          });
        }
      });
    }

    if (selectedPlan && selectedPlan.plan && selectedPlan.plan.length > 0) {
      selectedPlan.plan.forEach(item => {
        entities.push({
          type: 'plan-item',
          id: item._id || item.plan_item_id,
          displayName: item.text || item.name || 'Unknown Plan Item'
        });
      });
    }

    if (experience?.destination) {
      const destId = typeof experience.destination === 'string'
        ? experience.destination
        : experience.destination._id;
      const destName = typeof experience.destination === 'object'
        ? (experience.destination.name || 'Unknown Destination')
        : 'Unknown Destination';

      entities.push({
        type: 'destination',
        id: destId,
        displayName: destName
      });
    }

    if (experience) {
      entities.push({
        type: 'experience',
        id: experience._id,
        displayName: experience.name || 'Unknown Experience'
      });
    }

    return entities;
  }, [allPlanCollaborators, selectedPlan, experience]);

  // Create entity data map for mention rendering
  const entityData = useMemo(() => {
    const data = {};

    if (allPlanCollaborators && allPlanCollaborators.length > 0) {
      allPlanCollaborators.forEach(user => {
        const userData = user.user || user;
        const userId = userData._id || user._id;

        if (userId) {
          data[userId] = {
            _id: userId,
            name: userData.name || userData.email?.split('@')[0],
            email: userData.email,
            bio: userData.bio
          };
        }
      });
    }

    if (selectedPlan && selectedPlan.plan && selectedPlan.plan.length > 0) {
      selectedPlan.plan.forEach(item => {
        const itemId = item._id || item.plan_item_id;
        data[itemId] = {
          _id: itemId,
          type: 'plan-item',
          name: item.text || item.name,
          text: item.text,
          url: item.url,
          complete: item.complete,
          cost: item.cost,
          experienceId: experience?._id,
          planId: selectedPlan._id
        };
      });
    }

    if (experience?.destination) {
      if (typeof experience.destination === 'object') {
        const destId = experience.destination._id;
        data[destId] = {
          _id: destId,
          name: experience.destination.name,
          city: experience.destination.city,
          country: experience.destination.country,
          description: experience.destination.description
        };
      } else {
        data[experience.destination] = {
          _id: experience.destination,
          name: 'Destination',
          city: null,
          country: null,
          description: null
        };
      }
    }

    if (experience) {
      data[experience._id] = {
        _id: experience._id,
        name: experience.name,
        description: experience.description,
        destination: experience.destination
      };
    }

    return data;
  }, [allPlanCollaborators, selectedPlan, experience]);

  return {
    allPlanCollaborators,
    availableEntities,
    entityData,
  };
}
