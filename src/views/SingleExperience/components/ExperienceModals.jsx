/**
 * ExperienceModals
 *
 * Aggregates all modal components rendered at the bottom of SingleExperience:
 *   - PhotoModal (hero photo viewer)
 *   - TransferOwnershipModal
 *   - ConfirmModal (remove experience, delete plan item, delete plan-instance item)
 *   - RequestPlanAccessModal
 *   - CollaboratorModal
 *   - SyncPlanModal
 *   - PlanItemModal (add/edit plan item)
 *   - PlanItemDetailsModal (view + assign + comment + cost)
 *   - CostEntry (inline cost modal)
 *   - IncompleteChildrenDialog
 *   - PhotoUploadModal
 *
 * Pure relocation from SingleExperience.jsx.
 */

import PhotoModal from '../../../components/PhotoModal/PhotoModal';
import PhotoUploadModal from '../../../components/PhotoUploadModal/PhotoUploadModal';
import RequestPlanAccessModal from '../../../components/RequestPlanAccessModal/RequestPlanAccessModal';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';
import TransferOwnershipModal from '../../../components/TransferOwnershipModal/TransferOwnershipModal';
import CostEntry from '../../../components/CostEntry';
import IncompleteChildrenDialog from '../../../components/IncompleteChildrenDialog/IncompleteChildrenDialog';
import PlanItemDetailsModal from '../../../components/PlanItemDetailsModal/PlanItemDetailsModal';
import CollaboratorModal from './CollaboratorModal';
import SyncPlanModal from './SyncPlanModal';
import PlanItemModal from './PlanItemModal';
import { lang } from '../../../lang.constants';
import { logger } from '../../../utilities/logger';
import { canEditPlan } from '../../../utilities/permissions';
import { attemptScrollToItem } from '../../../utilities/scroll-utils';
import { updateExperience } from '../../../utilities/experiences-api';
import { requestPlanAccess } from '../../../utilities/plans-api';
import { idEquals } from '../../../utilities/id-utils';

export default function ExperienceModals({
  experience,
  user,
  navigate,
  // Modal mgmt
  isModalOpen,
  closeModal,
  openModal,
  MODAL_NAMES,
  // Photos
  heroPhotos,
  photoViewerIndex,
  setExperience,
  updateExperienceInContext,
  // Confirm modal data
  planItemToDelete,
  planInstanceItemToDelete,
  setPlanInstanceItemToDelete,
  // Plan-item handlers
  handlePlanDelete,
  handlePlanInstanceItemDelete,
  // Plan instance vs experience save
  editingPlanItem,
  setEditingPlanItem,
  planItemFormState,
  loading,
  activeTab,
  handleSaveExperiencePlanItem,
  handleSavePlanInstanceItem,
  // Plan access
  requestAccessPlanId,
  setRequestAccessPlanId,
  accessDeniedPlanId,
  setAccessRequestSent,
  // Plan + details
  selectedPlan,
  selectedPlanId,
  selectedDetailsItem,
  setSelectedDetailsItem,
  detailsModalInitialTab,
  setDetailsModalInitialTab,
  // Confirm remove plan
  confirmRemoveExperience,
  // Collaborators (CollaboratorModal)
  collaboratorManager,
  experienceCollaborators,
  planCollaborators,
  // Sync
  showSyncModal,
  closeSyncModal,
  syncChanges,
  selectedSyncItems,
  setSelectedSyncItems,
  confirmSyncPlan,
  syncLoading,
  // Plan-item details modal hooks
  costs,
  allPlanCollaborators,
  handleAddNoteToItem,
  handleUpdateNoteOnItem,
  handleDeleteNoteFromItem,
  handleVoteNoteRelevancyOnItem,
  handleAssign,
  handleUnassign,
  handleUpdateTitle,
  handleAddCostForItem,
  handleAddDetail,
  handleSharePlanItem,
  handlePlanItemToggleComplete,
  handlePrevPlanItemDetails,
  handleNextPlanItemDetails,
  detailsNavIndex,
  presenceConnected,
  planMembers,
  availableEntities,
  entityData,
  // Inline cost
  inlineCostPlanItem,
  setInlineCostPlanItem,
  handleSaveInlineCost,
  inlineCostLoading,
  // Incomplete children
  incompleteChildrenDialogData,
  setIncompleteChildrenDialogData,
  // Hash
  writeExperienceHash,
  // Toasts
  success,
  showError,
}) {
  return (
    <>
      {isModalOpen(MODAL_NAMES.PHOTO_VIEWER) && (
        <PhotoModal photos={heroPhotos} initialIndex={photoViewerIndex} onClose={closeModal} />
      )}

      <TransferOwnershipModal
        show={isModalOpen(MODAL_NAMES.DELETE_EXPERIENCE)}
        onClose={closeModal}
        experience={experience}
        onSuccess={() => {
          navigate('/experiences');
        }}
      />

      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.REMOVE_PLAN)}
        onClose={closeModal}
        onConfirm={confirmRemoveExperience}
        title={lang.current.modal.removeExperienceFromPlans}
        message={lang.current.modal.removeExperienceMessage}
        itemName={experience?.name}
        additionalInfo={['Your plan progress', 'Completed items', 'Personal notes']}
        warningText="Your progress will be permanently deleted!"
        confirmText={lang.current.modal.removeExperienceConfirmButton}
        confirmVariant="danger"
      />

      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.DELETE_PLAN_ITEM)}
        onClose={closeModal}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title={lang.current.modal.confirmDeletePlanItemTitle}
        message="You are about to delete this plan item"
        itemName={planItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      <ConfirmModal
        show={isModalOpen(MODAL_NAMES.DELETE_PLAN_INSTANCE_ITEM)}
        onClose={() => {
          closeModal();
          setPlanInstanceItemToDelete(null);
        }}
        onConfirm={handlePlanInstanceItemDelete}
        title={lang.current.modal.confirmDeletePlanItemTitle}
        message="You are about to delete this plan item"
        itemName={planInstanceItemToDelete?.text}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      <RequestPlanAccessModal
        show={isModalOpen(MODAL_NAMES.REQUEST_PLAN_ACCESS)}
        planId={requestAccessPlanId}
        onClose={() => {
          closeModal();
          setRequestAccessPlanId(null);
        }}
        onSubmitRequest={async ({ planId, message }) => {
          try {
            await requestPlanAccess(planId, message);
            success(lang.current.planAccess.requestSent, { duration: 3000 });
            if (planId === accessDeniedPlanId) {
              setAccessRequestSent(true);
            }
          } catch (err) {
            logger.error('[SingleExperience] Failed to request plan access', { planId, error: err?.message }, err);
            throw err;
          }
        }}
      />

      {/* Add Collaborator Modal */}
      <CollaboratorModal
        show={collaboratorManager.showCollaboratorModal}
        onHide={collaboratorManager.closeCollaboratorModal}
        onSearch={collaboratorManager.handleSearchUsers}
        onAddCollaborators={collaboratorManager.handleAddCollaborator}
        onRemoveCollaborator={collaboratorManager.handleRemoveSelectedCollaborator}
        onSendEmailInvite={collaboratorManager.handleSendEmailInvite}
        onSelectEntity={collaboratorManager.handleSelectEntity}
        entityImportMessage={collaboratorManager.entityImportMessage}
        onDismissImportMessage={() => collaboratorManager.setEntityImportMessage('')}
        entityImportLoading={collaboratorManager.entityImportLoading}
        context={collaboratorManager.collaboratorContext}
        searchTerm={collaboratorManager.collaboratorSearch}
        onSearchTermChange={collaboratorManager.setCollaboratorSearch}
        searchResults={collaboratorManager.searchResults}
        selectedCollaborators={collaboratorManager.selectedCollaborators}
        onToggleCollaborator={collaboratorManager.handleSelectUser}
        existingCollaborators={
          collaboratorManager.collaboratorContext === 'plan' ? planCollaborators : experienceCollaborators
        }
        removedCollaborators={collaboratorManager.removedCollaborators}
        addSuccess={collaboratorManager.collaboratorAddSuccess}
        addedCollaborators={collaboratorManager.addedCollaborators}
        actuallyRemovedCollaborators={collaboratorManager.actuallyRemovedCollaborators}
        experienceName={experience?.name || ''}
        destinationName={experience?.destination?.name || ''}
      />

      {/* Sync Plan Modal */}
      <SyncPlanModal
        show={showSyncModal}
        onHide={closeSyncModal}
        syncChanges={syncChanges}
        selectedSyncItems={selectedSyncItems}
        setSelectedSyncItems={setSelectedSyncItems}
        onConfirmSync={confirmSyncPlan}
        loading={syncLoading}
        lang={lang}
      />

      {/* Plan Instance Item Modal */}
      <PlanItemModal
        show={isModalOpen(MODAL_NAMES.ADD_EDIT_PLAN_ITEM)}
        onHide={() => {
          closeModal();
          setEditingPlanItem({});
        }}
        initialData={editingPlanItem}
        mode={planItemFormState === 1 ? 'add' : 'edit'}
        onSave={activeTab === 'experience' ? handleSaveExperiencePlanItem : handleSavePlanInstanceItem}
        loading={loading}
        isPlanInstance={activeTab !== 'experience'}
        langStrings={lang}
      />

      {/* Plan Item Details Modal */}
      <PlanItemDetailsModal
        show={isModalOpen(MODAL_NAMES.PLAN_ITEM_DETAILS)}
        onClose={() => {
          closeModal();
          setSelectedDetailsItem(null);
          setDetailsModalInitialTab('notes');

          const currentHash = window.location.hash || '';
          if (currentHash.includes('-item-')) {
            const planIdFromHash = currentHash.substring(6).split('-item-')[0];
            writeExperienceHash({
              planId: planIdFromHash || selectedPlanId,
              stripItem: true,
              reason: 'close-plan-item-details',
            });
          }
        }}
        planItem={selectedDetailsItem}
        plan={selectedPlan}
        costs={costs}
        currentUser={user}
        collaborators={allPlanCollaborators}
        onAddNote={handleAddNoteToItem}
        onUpdateNote={handleUpdateNoteOnItem}
        onDeleteNote={handleDeleteNoteFromItem}
        onVoteNoteRelevancy={handleVoteNoteRelevancyOnItem}
        initialTab={detailsModalInitialTab}
        onAssign={handleAssign}
        onUnassign={handleUnassign}
        onUpdateTitle={handleUpdateTitle}
        canEdit={selectedPlan ? canEditPlan(user, selectedPlan) : false}
        displayCurrency={user?.preferences?.currency}
        onToggleComplete={async (planItem) => {
          if (!selectedPlan || !planItem) return;

          // Optimistically update the modal button state immediately
          setSelectedDetailsItem((prev) => (prev ? { ...prev, complete: !prev.complete } : prev));

          await handlePlanItemToggleComplete(planItem);
        }}
        availableEntities={availableEntities}
        entityData={entityData}
        onPlanItemClick={(itemId, entity) => {
          logger.debug('[SingleExperience] Plan item click from notes', { itemId, entity });
          attemptScrollToItem(itemId, { shouldHighlight: true, anticipationDelay: 0 });
        }}
        onAddCostForItem={handleAddCostForItem}
        onAddDetail={handleAddDetail}
        onShare={handleSharePlanItem}
        presenceConnected={presenceConnected}
        planMembers={planMembers}
        experienceName={experience?.name || ''}
        onPrev={detailsNavIndex > 0 ? handlePrevPlanItemDetails : undefined}
        onNext={
          detailsNavIndex >= 0 && selectedPlan?.plan && detailsNavIndex < selectedPlan.plan.length - 1
            ? handleNextPlanItemDetails
            : undefined
        }
      />

      {/* Inline Cost Entry Modal */}
      <CostEntry
        show={isModalOpen(MODAL_NAMES.INLINE_COST_ENTRY)}
        onHide={() => {
          closeModal();
          setInlineCostPlanItem(null);
        }}
        editingCost={
          inlineCostPlanItem
            ? { plan_item: inlineCostPlanItem._id || inlineCostPlanItem.plan_item_id }
            : null
        }
        collaborators={allPlanCollaborators}
        planItems={selectedPlan?.plan || []}
        onSave={handleSaveInlineCost}
        loading={inlineCostLoading}
      />

      {/* Incomplete Children Dialog */}
      <IncompleteChildrenDialog
        show={!!incompleteChildrenDialogData}
        onClose={() => setIncompleteChildrenDialogData(null)}
        parentItem={incompleteChildrenDialogData?.parentItem}
        incompleteChildren={incompleteChildrenDialogData?.incompleteChildren || []}
        onToggleChildComplete={async (childItem) => {
          await handlePlanItemToggleComplete(childItem, { skipChildCheck: true });
        }}
        onCompleteParent={async () => {
          if (incompleteChildrenDialogData?.parentItem) {
            await handlePlanItemToggleComplete(incompleteChildrenDialogData.parentItem, { skipChildCheck: true });
          }
        }}
        lang={lang}
      />

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        show={isModalOpen(MODAL_NAMES.PHOTO_UPLOAD)}
        onClose={closeModal}
        entityType="experience"
        entity={experience}
        photos={experience?.photos_full || experience?.photos || []}
        onSave={async (data) => {
          try {
            const photoIds = Array.isArray(data.photos)
              ? data.photos.map((p) => (typeof p === 'object' ? p._id : p))
              : [];

            const updated = await updateExperience(experience._id, {
              photos: photoIds,
            });

            if (updated) {
              const fullPhotos = data.photos_full || [];
              setExperience((prev) => ({
                ...prev,
                photos: fullPhotos.length > 0 ? fullPhotos : (updated.photos || photoIds),
                photos_full: fullPhotos,
              }));

              if (updateExperienceInContext) {
                updateExperienceInContext(updated);
              }

              success(lang.current.success.photosUpdated);
            }
          } catch (err) {
            logger.error('[SingleExperience] Failed to save photos', { error: err.message });
            showError(err.message || 'Failed to save photos');
            throw err;
          }
        }}
      />
    </>
  );
}
