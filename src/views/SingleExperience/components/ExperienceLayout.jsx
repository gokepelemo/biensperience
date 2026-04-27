/**
 * ExperienceLayout
 *
 * Main two-column layout for SingleExperience: breadcrumb, hero+plan card,
 * and sidebar. Pure relocation from SingleExperience.jsx — wraps existing
 * subcomponents.
 */

import { Box } from '@chakra-ui/react';
import { Container, Row, Col, Breadcrumb } from '../../../components/design-system';
import ExperienceHero from './ExperienceHero';
import ExperienceSidebar from './ExperienceSidebar';
import ExperiencePlanCard from './ExperiencePlanCard';

export default function ExperienceLayout(props) {
  const { experience, ...rest } = props;

  return (
    <Box minH="100vh" pt="4" pb="8" bg="bg">
      <Container>
        <Breadcrumb
          items={
            experience.destination && experience.destination.name
              ? [{ label: experience.destination.name, href: `/destinations/${experience.destination._id}` }]
              : []
          }
          currentPage={experience.name}
          backTo={experience.destination ? `/destinations/${experience.destination._id}` : '/'}
          backLabel={experience.destination ? experience.destination.name : 'Home'}
        />

        <Row>
          {/* Main Content Column (8 cols on lg+) */}
          <Col lg={8}>
            <ExperienceHero
              experience={experience}
              experienceOwner={rest.experienceOwner}
              user={rest.user}
              navigate={rest.navigate}
              heroPhotos={rest.heroPhotos}
              openModal={rest.openModal}
              setPhotoViewerIndex={rest.setPhotoViewerIndex}
              MODAL_NAMES={rest.MODAL_NAMES}
              h1Ref={rest.h1Ref}
            />

            <ExperiencePlanCard
              experienceId={rest.experienceId}
              experience={experience}
              user={rest.user}
              activeTab={rest.activeTab}
              setActiveTab={rest.setActiveTab}
              userPlan={rest.userPlan}
              setUserPlan={rest.setUserPlan}
              sharedPlans={rest.sharedPlans}
              setSharedPlans={rest.setSharedPlans}
              selectedPlanId={rest.selectedPlanId}
              setSelectedPlanId={rest.setSelectedPlanId}
              handlePlanChange={rest.handlePlanChange}
              plansLoading={rest.plansLoading}
              experienceTabLoading={rest.experienceTabLoading}
              loading={rest.loading}
              userHasExperience={rest.userHasExperience}
              experienceOwner={rest.experienceOwner}
              experienceCollaborators={rest.experienceCollaborators}
              experienceOwnerLoading={rest.experienceOwnerLoading}
              experienceCollaboratorsLoading={rest.experienceCollaboratorsLoading}
              planOwner={rest.planOwner}
              planCollaborators={rest.planCollaborators}
              planOwnerLoading={rest.planOwnerLoading}
              planCollaboratorsLoading={rest.planCollaboratorsLoading}
              expandedParents={rest.expandedParents}
              animatingCollapse={rest.animatingCollapse}
              getExpansionKey={rest.getExpansionKey}
              isItemExpanded={rest.isItemExpanded}
              toggleExpanded={rest.toggleExpanded}
              handleAddPlanInstanceItem={rest.handleAddPlanInstanceItem}
              handleEditPlanInstanceItem={rest.handleEditPlanInstanceItem}
              handleViewPlanItemDetails={rest.handleViewPlanItemDetails}
              handleAddExperiencePlanItem={rest.handleAddExperiencePlanItem}
              handleEditExperiencePlanItem={rest.handleEditExperiencePlanItem}
              handleReorderExperiencePlanItems={rest.handleReorderExperiencePlanItems}
              handleReorderPlanItems={rest.handleReorderPlanItems}
              handlePlanItemToggleComplete={rest.handlePlanItemToggleComplete}
              setPlanItemToDelete={rest.setPlanItemToDelete}
              handleOpenPlanDeleteModal={rest.handleOpenPlanDeleteModal}
              setPlanInstanceItemToDelete={rest.setPlanInstanceItemToDelete}
              handleOpenPlanInstanceDeleteModal={rest.handleOpenPlanInstanceDeleteModal}
              hoveredPlanItem={rest.hoveredPlanItem}
              setHoveredPlanItem={rest.setHoveredPlanItem}
              openModal={rest.openModal}
              MODAL_NAMES={rest.MODAL_NAMES}
              setRequestAccessPlanId={rest.setRequestAccessPlanId}
              navigate={rest.navigate}
              location={rest.location}
              accessDeniedPlanId={rest.accessDeniedPlanId}
              accessRequestSent={rest.accessRequestSent}
              showSyncButton={rest.showSyncButton}
              showSyncAlert={rest.showSyncAlert}
              dismissSyncAlert={rest.dismissSyncAlert}
              handleSyncPlan={rest.handleSyncPlan}
              displayedPlannedDate={rest.displayedPlannedDate}
              setIsEditingDate={rest.setIsEditingDate}
              setPlannedDate={rest.setPlannedDate}
              setShowDatePickerState={rest.setShowDatePickerState}
              plannedDateRef={rest.plannedDateRef}
              costs={rest.costs}
              costSummary={rest.costSummary}
              costsLoading={rest.costsLoading}
              addCost={rest.addCost}
              updateCost={rest.updateCost}
              deleteCost={rest.deleteCost}
              presenceConnected={rest.presenceConnected}
              experienceMembers={rest.experienceMembers}
              planMembers={rest.planMembers}
              setTyping={rest.setTyping}
              intent={rest.intent}
              bienbotNewItemIds={rest.bienbotNewItemIds}
              collaboratorManager={rest.collaboratorManager}
              handleExperience={rest.handleExperience}
            />
          </Col>

          {/* Sidebar Column (4 cols on lg+) */}
          <Col lg={4}>
            <ExperienceSidebar
              experience={experience}
              experienceId={rest.experienceId}
              user={rest.user}
              userPlan={rest.userPlan}
              userHasExperience={rest.userHasExperience}
              selectedPlan={rest.selectedPlan}
              loading={rest.loading}
              plansLoading={rest.plansLoading}
              displayedPlannedDate={rest.displayedPlannedDate}
              isEditingDate={rest.isEditingDate}
              setIsEditingDate={rest.setIsEditingDate}
              plannedDate={rest.plannedDate}
              setPlannedDate={rest.setPlannedDate}
              handleDateUpdate={rest.handleDateUpdate}
              handleAddExperience={rest.handleAddExperience}
              pendingShift={rest.pendingShift}
              onShiftDates={rest.onShiftDates}
              onKeepDates={rest.onKeepDates}
              isModalOpen={rest.isModalOpen}
              openModal={rest.openModal}
              closeModal={rest.closeModal}
              setShowDatePickerState={rest.setShowDatePickerState}
              handleOpenDeleteExperienceModal={rest.handleOpenDeleteExperienceModal}
              MODAL_NAMES={rest.MODAL_NAMES}
              handleExperience={rest.handleExperience}
              handleShareExperience={rest.handleShareExperience}
              planButtonRef={rest.planButtonRef}
              planBtnWidth={rest.planBtnWidth}
              favHover={rest.favHover}
              setFavHover={rest.setFavHover}
              activeTab={rest.activeTab}
            />
          </Col>
        </Row>
      </Container>
    </Box>
  );
}
