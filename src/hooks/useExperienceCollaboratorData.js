/**
 * useExperienceCollaboratorData Hook
 *
 * Derives owner/collaborator IDs from experience and currentPlan permissions,
 * then fetches the corresponding user records via `useCollaboratorUsers`.
 *
 * Returns the IDs (for downstream hooks that need them, e.g.
 * `useCollaboratorManager`) plus the resolved user objects.
 *
 * Extracted from SingleExperience.jsx — pure relocation of existing behavior.
 *
 * @module hooks/useExperienceCollaboratorData
 */

import { useMemo } from 'react';
import { useCollaboratorUsers } from './useCollaboratorUsers';

export default function useExperienceCollaboratorData({ experience, currentPlan }) {
  const experienceOwnerPermission = useMemo(
    () => experience?.permissions?.find((p) => p.entity === 'user' && p.type === 'owner'),
    [experience?.permissions]
  );

  const experienceOwnerId = useMemo(
    () => experienceOwnerPermission?._id,
    [experienceOwnerPermission]
  );

  const experienceCollaboratorIds = useMemo(
    () =>
      experience?.permissions
        ?.filter((p) => p.entity === 'user' && p.type === 'collaborator')
        .map((p) => p._id) || [],
    [experience?.permissions]
  );

  const planOwnerPermission = useMemo(
    () => currentPlan?.permissions?.find((p) => p.entity === 'user' && p.type === 'owner'),
    [currentPlan]
  );

  const planOwnerId = useMemo(() => planOwnerPermission?._id, [planOwnerPermission]);

  const planCollaboratorIds = useMemo(
    () =>
      currentPlan?.permissions
        ?.filter((p) => p.entity === 'user' && p.type === 'collaborator')
        .map((p) => p._id) || [],
    [currentPlan]
  );

  const experienceOwnerIds = useMemo(
    () => (experienceOwnerId ? [experienceOwnerId] : []),
    [experienceOwnerId]
  );

  const planOwnerIds = useMemo(() => (planOwnerId ? [planOwnerId] : []), [planOwnerId]);

  const {
    users: experienceOwnerData,
    loading: experienceOwnerLoading,
    refetch: refetchExperienceOwner,
  } = useCollaboratorUsers(experienceOwnerIds);
  const experienceOwner = experienceOwnerData?.[0];

  const { users: experienceCollaborators, loading: experienceCollaboratorsLoading } =
    useCollaboratorUsers(experienceCollaboratorIds);

  const { users: planOwnerData, loading: planOwnerLoading } = useCollaboratorUsers(planOwnerIds);
  const planOwner = planOwnerData?.[0];

  const { users: planCollaborators, loading: planCollaboratorsLoading } =
    useCollaboratorUsers(planCollaboratorIds);

  return {
    experienceOwnerId,
    experienceOwner,
    experienceOwnerLoading,
    refetchExperienceOwner,
    experienceCollaborators,
    experienceCollaboratorsLoading,
    planOwner,
    planOwnerLoading,
    planCollaborators,
    planCollaboratorsLoading,
  };
}
