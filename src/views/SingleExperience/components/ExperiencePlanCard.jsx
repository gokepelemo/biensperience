/**
 * ExperiencePlanCard
 *
 * The white plan-tabs card in SingleExperience: PlanTabsNavigation,
 * ActivityFeed/Experience/MyPlan tab content, plus the experience-tab loading
 * skeleton and the plan-access-denied / no-plan empty states.
 *
 * Pure relocation from SingleExperience.jsx.
 */

import { Box, Flex } from '@chakra-ui/react';
import PlanTabsNavigation from './PlanTabsNavigation';
import ExperienceTabContent from './ExperienceTabContent';
import MyPlanTabContent from './MyPlanTabContent';
import ActivityFeed from './ActivityFeed';
import PlanAccessDenied from '../../../components/PlanAccessDenied/PlanAccessDenied';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import { EmptyState } from '../../../components/design-system';
import { lang } from '../../../lang.constants';
import { idEquals } from '../../../utilities/id-utils';
import { isOwner } from '../../../utilities/permissions';

export default function ExperiencePlanCard({
  experienceId,
  experience,
  user,
  // Tabs
  activeTab,
  setActiveTab,
  // Plans
  userPlan,
  setUserPlan,
  sharedPlans,
  setSharedPlans,
  selectedPlanId,
  setSelectedPlanId,
  handlePlanChange,
  plansLoading,
  experienceTabLoading,
  loading,
  userHasExperience,
  // Plan owner / collaborators
  experienceOwner,
  experienceCollaborators,
  experienceOwnerLoading,
  experienceCollaboratorsLoading,
  planOwner,
  planCollaborators,
  planOwnerLoading,
  planCollaboratorsLoading,
  // Hierarchy state
  expandedParents,
  animatingCollapse,
  getExpansionKey,
  isItemExpanded,
  toggleExpanded,
  // Plan-item handlers
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  handleViewPlanItemDetails,
  handleAddExperiencePlanItem,
  handleEditExperiencePlanItem,
  handleReorderExperiencePlanItems,
  handleReorderPlanItems,
  handlePlanItemToggleComplete,
  setPlanItemToDelete,
  handleOpenPlanDeleteModal,
  setPlanInstanceItemToDelete,
  handleOpenPlanInstanceDeleteModal,
  // Hover state
  hoveredPlanItem,
  setHoveredPlanItem,
  // Modal mgmt for empty-state CTA
  openModal,
  MODAL_NAMES,
  setRequestAccessPlanId,
  navigate,
  location,
  // Plan access denied
  accessDeniedPlanId,
  accessRequestSent,
  // Sync banner
  showSyncButton,
  showSyncAlert,
  dismissSyncAlert,
  handleSyncPlan,
  // Date editing
  displayedPlannedDate,
  setIsEditingDate,
  setPlannedDate,
  setShowDatePickerState,
  plannedDateRef,
  // Costs
  costs,
  costSummary,
  costsLoading,
  addCost,
  updateCost,
  deleteCost,
  // Presence
  presenceConnected,
  experienceMembers,
  planMembers,
  setTyping,
  // Intent
  intent,
  // BienBot fade-in
  bienbotNewItemIds,
  // Collaborator manager
  collaboratorManager,
  // Plan create
  handleExperience,
}) {
  return (
    <Box bg="bg" border="1px solid" borderColor="border" borderRadius="lg" mb="6" overflow="visible">
      <Box p={{ base: '4', md: '6' }}>
        {/* Plan Navigation Tabs */}
        <PlanTabsNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          userPlan={userPlan}
          sharedPlans={sharedPlans}
          plansLoading={plansLoading}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={setSelectedPlanId}
          handlePlanChange={handlePlanChange}
        />

        {/* Activity Feed Tab Content */}
        {activeTab === 'activity' && <ActivityFeed experienceId={experienceId} />}

        {/* Experience Plan Items Tab Content */}
        {activeTab === 'experience' &&
          (experienceTabLoading ? (
            <Box className="experience-plan-view" py="4">
              <Flex className="plan-header-row" justify="space-between" align="center" gap="5" mb="4">
                <UsersListDisplay loading={true} owner={null} users={[]} messageKey="CreatingPlan" reserveSpace={true} />
                <Flex justify="flex-end">
                  <SkeletonLoader variant="rectangle" width="120px" height="40px" />
                </Flex>
              </Flex>
              <Box className="plan-items-skeleton" mt="4">
                {[1, 2, 3].map((i) => (
                  <Box
                    key={i}
                    className="plan-item-card"
                    p="4"
                    mb="2"
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="border"
                  >
                    <Flex align="center" gap="3" mb="2">
                      <SkeletonLoader variant="circle" width={24} height={24} />
                      <SkeletonLoader variant="text" width="70%" height={20} />
                    </Flex>
                    <SkeletonLoader variant="text" lines={2} height={16} />
                  </Box>
                ))}
              </Box>
            </Box>
          ) : experience.plan_items && experience.plan_items.length > 0 ? (
            <ExperienceTabContent
              user={user}
              experience={experience}
              experienceOwner={experienceOwner}
              experienceCollaborators={experienceCollaborators}
              experienceOwnerLoading={experienceOwnerLoading}
              experienceCollaboratorsLoading={experienceCollaboratorsLoading}
              expandedParents={expandedParents}
              animatingCollapse={animatingCollapse}
              getExpansionKey={getExpansionKey}
              isItemExpanded={isItemExpanded}
              handleAddExperiencePlanItem={handleAddExperiencePlanItem}
              handleEditExperiencePlanItem={handleEditExperiencePlanItem}
              openCollaboratorModal={collaboratorManager.openCollaboratorModal}
              toggleExpanded={toggleExpanded}
              setPlanItemToDelete={setPlanItemToDelete}
              setShowPlanDeleteModal={handleOpenPlanDeleteModal}
              onReorderExperiencePlanItems={handleReorderExperiencePlanItems}
              lang={lang}
              presenceConnected={presenceConnected}
              experienceMembers={experienceMembers}
            />
          ) : (
            <EmptyState
              variant="plans"
              title={isOwner ? 'No Plan Items' : 'No Plan Items'}
              description={
                isOwner
                  ? 'This experience has no plan items yet. Add some to help others plan their trip.'
                  : `${experience.name} doesn't have any plan items yet.`
              }
              primaryAction={isOwner ? 'Add Plan Item' : null}
              onPrimaryAction={isOwner ? () => handleAddExperiencePlanItem() : null}
              size="md"
            />
          ))}

        {/* Plan Access Denied (hash target inaccessible) */}
        {activeTab === 'myplan' && accessDeniedPlanId && (
          <PlanAccessDenied
            planId={accessDeniedPlanId}
            requestSent={accessRequestSent}
            onRequestAccess={(planId) => {
              setRequestAccessPlanId(planId);
              openModal(MODAL_NAMES.REQUEST_PLAN_ACCESS);
            }}
            onSignIn={() => {
              navigate('/signup', { state: { from: location } });
            }}
          />
        )}

        {/* My Plan Tab Content */}
        {activeTab === 'myplan' && !accessDeniedPlanId && (selectedPlanId || userPlan?._id) && (
          <MyPlanTabContent
            selectedPlanId={selectedPlanId || userPlan?._id}
            user={user}
            idEquals={idEquals}
            userPlan={userPlan}
            setUserPlan={setUserPlan}
            sharedPlans={sharedPlans}
            setSharedPlans={setSharedPlans}
            planOwner={planOwner}
            planCollaborators={planCollaborators}
            planOwnerLoading={planOwnerLoading}
            planCollaboratorsLoading={planCollaboratorsLoading}
            hashSelecting={!!(intent && !intent.consumed)}
            showSyncButton={showSyncButton}
            showSyncAlert={showSyncAlert}
            dismissSyncAlert={dismissSyncAlert}
            loading={loading}
            plansLoading={plansLoading}
            expandedParents={expandedParents}
            animatingCollapse={animatingCollapse}
            getExpansionKey={getExpansionKey}
            isItemExpanded={isItemExpanded}
            displayedPlannedDate={displayedPlannedDate}
            setIsEditingDate={setIsEditingDate}
            setPlannedDate={setPlannedDate}
            setShowDatePicker={setShowDatePickerState}
            plannedDateRef={plannedDateRef}
            handleSyncPlan={handleSyncPlan}
            handleAddPlanInstanceItem={handleAddPlanInstanceItem}
            handleEditPlanInstanceItem={handleEditPlanInstanceItem}
            handleViewPlanItemDetails={handleViewPlanItemDetails}
            openCollaboratorModal={collaboratorManager.openCollaboratorModal}
            toggleExpanded={toggleExpanded}
            setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
            setShowPlanInstanceDeleteModal={handleOpenPlanInstanceDeleteModal}
            handlePlanItemToggleComplete={handlePlanItemToggleComplete}
            onReorderPlanItems={handleReorderPlanItems}
            hoveredPlanItem={hoveredPlanItem}
            setHoveredPlanItem={setHoveredPlanItem}
            lang={lang}
            costs={costs}
            costSummary={costSummary}
            costsLoading={costsLoading}
            onAddCost={addCost}
            onUpdateCost={updateCost}
            onDeleteCost={deleteCost}
            presenceConnected={presenceConnected}
            planMembers={planMembers}
            setTyping={setTyping}
            bienbotNewItemIds={bienbotNewItemIds}
          />
        )}

        {/* If My Plan tab selected but no plan is selected, show empty state */}
        {activeTab === 'myplan' && !(selectedPlanId || userPlan?._id) && (
          <EmptyState
            variant="plans"
            title={lang.current.modal.noPlansFallback}
            description="There are no user plans for this experience yet."
            primaryAction={!userHasExperience ? 'Plan This Experience' : null}
            onPrimaryAction={!userHasExperience ? () => handleExperience() : null}
            size="md"
          />
        )}
      </Box>
    </Box>
  );
}
