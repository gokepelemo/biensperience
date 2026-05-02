/**
 * PlanItemDetailsModal Component
 * Modal for viewing and managing all details of a plan item (notes, assignment, etc.)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Modal } from '../design-system';
import PlanItemNotes from '../PlanItemNotes/PlanItemNotes';
import AddPlanItemDetailModal, { DETAIL_TYPES } from '../AddPlanItemDetailModal';
import AddDetailTypeModal from '../AddDetailTypeModal';
import AddLocationModal from '../AddLocationModal';
import AddDateModal from '../AddDateModal';
import DocumentsTab from './DocumentsTab';
import PhotosTab from './PhotosTab';
import DetailsTab from './DetailsTab';
import LocationTab from './LocationTab';
import ChatTab from './ChatTab';
import EditableTitle from './EditableTitle';
import ItemNavBar from './ItemNavBar';
import AssignmentSection from './AssignmentSection';
import CostPlanningInfoSection from './CostPlanningInfoSection';
import TabsBar from './TabsBar';
import styles from './PlanItemDetailsModal.module.css';
import { logger } from '../../utilities/logger';
import { convertCostToTarget, fetchRates } from '../../utilities/currency-conversion';
import { lang } from '../../lang.constants';
import { useBienBotEntityAction } from '../../hooks/useBienBotEntityAction';
import { useNavigationContext } from '../../contexts/NavigationContext';
import usePlanItemNavigation from '../../hooks/usePlanItemNavigation';
import useGroupedDetails from '../../hooks/useGroupedDetails';
import useChatChannel from '../../hooks/useChatChannel';
import exportPlanItemDetailsPDF from '../../utilities/exportPlanItemDetailsPDF';
import usePlanItemActions from '../../hooks/usePlanItemActions';

export default function PlanItemDetailsModal({
  show,
  onClose,
  planItem,
  plan,
  currentUser,
  collaborators = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onVoteNoteRelevancy,
  onAssign,
  onUnassign,
  onUpdateTitle,
  onToggleComplete,
  canEdit = false,
  // For mentions support
  availableEntities = [],
  entityData = {},
  // Initial tab to display when modal opens
  initialTab = 'notes',
  // Callback for when a plan item mention is clicked (to close modal and scroll)
  onPlanItemClick,
  // Callback for inline cost addition - called with planItem to add a cost for this item
  onAddCostForItem,
  // Callback for adding any detail type - called with { type, planItemId, data, document }
  onAddDetail,
  // Display currency - if different from plan currency, amounts will be converted for display
  displayCurrency,
  // Live costs array from usePlanCosts hook (overrides plan.costs for real-time updates)
  costs: costsProp,
  // Callback for sharing a plan item - called with planItem
  onShare,
  // Real-time presence for online indicators
  presenceConnected = false,
  planMembers = [],
  // Experience name for PDF export title
  experienceName = '',
  // Navigation callbacks for keyboard/swipe between plan items
  onPrev,
  onNext
}) {
  const streamApiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [showAddDetailModal, setShowAddDetailModal] = useState(false);
  const [selectedDetailType, setSelectedDetailType] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showDetailTypeSelectorModal, setShowDetailTypeSelectorModal] = useState(false);
  const [pdfExportBlocked, setPdfExportBlocked] = useState(false);
  // Local state for immediate UI feedback on scheduled date/time changes
  const [localScheduledDate, setLocalScheduledDate] = useState(null);
  const [localScheduledTime, setLocalScheduledTime] = useState(null);

  // Mobile/Tablet: allow the details modal to scroll within its fixed overlay.
  // Uses 991px breakpoint to match tab dropdown visibility (same breakpoint as .detailsTabs display: none)
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    if (!show) return;

    try {
      const mql = window.matchMedia('(max-width: 991px)');
      const update = () => setIsMobileViewport(!!mql.matches);
      update();

      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
      }

      // Safari fallback
      if (typeof mql.addListener === 'function') {
        mql.addListener(update);
        return () => mql.removeListener(update);
      }
    } catch (e) {
      // ignore
    }
  }, [show]);

  // Fetch exchange rates for currency conversion
  // Use displayCurrency if provided, otherwise plan currency
  const targetCurrencyForRates = displayCurrency || plan?.currency || 'USD';
  useEffect(() => {
    fetchRates(targetCurrencyForRates)
      .then(() => setRatesLoaded(true))
      .catch(() => setRatesLoaded(true)); // Still render even if rates fail
  }, [targetCurrencyForRates]);

  // Helper to normalize ID to string for comparison - defined outside component or memoized
  const normalizeId = (id) => {
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (typeof id === 'object' && id.toString) return id.toString();
    return String(id);
  };

  // Compute stable plan item ID string
  const planItemIdStr = normalizeId(planItem?._id);

  // Register plan and plan_item in NavigationContext so any BienBot session opened
  // from this modal has plan_id available in the navigationSchema from turn 1,
  // enabling all plan-item actions that require plan_id to resolve correctly.
  const { setNavigatedEntity, clearNavigationLevel } = useNavigationContext();
  useEffect(() => {
    if (!show || !plan?._id || !planItemIdStr) return;
    setNavigatedEntity('plan', { _id: plan._id, experience: plan.experience });
    setNavigatedEntity('plan_item', { _id: planItemIdStr, plan_id: plan._id });
    return () => {
      clearNavigationLevel(2);
    };
  }, [show, plan?._id, planItemIdStr, setNavigatedEntity, clearNavigationLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    chatClient,
    chatChannel,
    mergedChatError,
    mergedChatLoading,
    canInitChat,
    chatShouldShowLoading,
    uiTheme,
  } = useChatChannel({
    show,
    activeTab,
    apiKey: streamApiKey,
    plan,
    planItem,
  });

  // Track what we've initialized for - only reset on ACTUAL changes
  const initializedForRef = useRef({ show: false, planItemId: null });

  // Reset to specified initial tab when modal opens or a DIFFERENT plan item is selected.
  // planItemIdStr is included in deps so keyboard/swipe navigation between items
  // (where show and initialTab stay the same) correctly resets all local state.
  // The ref-based isDifferentPlanItem guard ensures we only reset on _id change, not
  // on every field update of the same item.
  useEffect(() => {
    const prevState = initializedForRef.current;
    const isModalOpening = show && !prevState.show;
    const isDifferentPlanItem = planItemIdStr && prevState.planItemId && planItemIdStr !== prevState.planItemId;
    const isFirstPlanItem = show && planItemIdStr && !prevState.planItemId;

    // Determine if we should reset BEFORE updating the ref
    const shouldReset = isModalOpening || isDifferentPlanItem || isFirstPlanItem;

    logger.debug('[PlanItemDetailsModal] Tab reset check', {
      show,
      planItemIdStr,
      prevShow: prevState.show,
      prevPlanItemId: prevState.planItemId,
      isModalOpening,
      isDifferentPlanItem,
      isFirstPlanItem,
      shouldReset,
      currentTab: activeTab
    });

    // Update ref to current values
    initializedForRef.current = { show, planItemId: planItemIdStr };

    // Only reset state when modal opens or when switching to a different plan item
    if (shouldReset) {
      logger.info('[PlanItemDetailsModal] Resetting tab state', {
        reason: isModalOpening ? 'modal_opening' : isDifferentPlanItem ? 'different_plan_item' : 'first_plan_item',
        from: activeTab,
        to: initialTab
      });
      setActiveTab(initialTab);
      setShowLocationModal(false);
      setShowDateModal(false);
      setShowDetailTypeSelectorModal(false);
      setShowAddDetailModal(false);
      setSelectedDetailType(null);
      setLocalScheduledDate(planItem?.scheduled_date || null);
      setLocalScheduledTime(planItem?.scheduled_time || null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- planItem fields are read only inside shouldReset block which already gates on planItemIdStr change
  }, [show, initialTab, planItemIdStr]);

  // Re-sync localScheduledDate/Time when the prop changes externally
  // (e.g. a collaborator updates via WebSocket or parent re-fetches)
  useEffect(() => {
    if (!show) return;
    const propDate = planItem?.scheduled_date || null;
    const propTime = planItem?.scheduled_time || null;
    // Only update if the prop has actually changed from what we last set locally
    // This avoids overwriting optimistic local updates before the parent re-renders
    if (propDate !== localScheduledDate) {
      setLocalScheduledDate(propDate);
    }
    if (propTime !== localScheduledTime) {
      setLocalScheduledTime(propTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, planItem?.scheduled_date, planItem?.scheduled_time]);

  const { handleTouchStart, handleTouchEnd } = usePlanItemNavigation({
    show,
    onPrev,
    onNext,
  });

  /**
   * Handle entity click from mentions in notes
   * For plan-item mentions: close modal, update URL hash, and trigger scroll to item
   * For other mentions (destination, experience, user): close modal, let Link handle navigation
   */
  const handleEntityClick = useCallback((entityType, entityId, entity) => {
    logger.debug('[PlanItemDetailsModal] handleEntityClick called', { entityType, entityId, entity, hasOnPlanItemClick: !!onPlanItemClick });

    if (entityType === 'plan-item') {
      // Update URL hash for deep-link (same-page navigation)
      // This ensures the hash reflects the deep-linked plan item
      if (entity && entity.planId) {
        const hash = `#plan-${entity.planId}-item-${entityId}`;
        const newUrl = `${window.location.pathname}${window.location.search || ''}${hash}`;
        logger.debug('[PlanItemDetailsModal] Updating URL hash', { hash, newUrl });
        if (window.location.href !== newUrl) {
          window.history.pushState(null, '', newUrl);
        }
      }

      // Close modal first
      logger.debug('[PlanItemDetailsModal] Closing modal for plan-item');
      onClose();

      // Use requestAnimationFrame to ensure modal is fully closed before scrolling
      // This callback fires after React commits DOM changes and browser paints
      // Double-RAF ensures the modal portal is unmounted from the DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          logger.debug('[PlanItemDetailsModal] RAF callback firing, calling onPlanItemClick', { entityId, entity });
          if (onPlanItemClick) {
            onPlanItemClick(entityId, entity);
          }
        });
      });
    } else {
      // For destination, experience, user mentions: close modal and let Link navigate
      logger.debug('[PlanItemDetailsModal] Closing modal for entity navigation', { entityType, entityId });
      onClose();
    }
  }, [onClose, onPlanItemClick]);

  // Compute online user IDs from presence data for UserAvatar indicators
  // Always include the current user when presence is connected (they're always online to themselves)
  const onlineUserIds = useMemo(() => {
    if (!presenceConnected) {
      return new Set();
    }
    const ids = new Set(planMembers?.map(member => member.userId?.toString()).filter(Boolean) || []);
    // Always include the current user - they should see themselves as online
    if (currentUser?._id) {
      ids.add(currentUser._id.toString());
    }
    return ids;
  }, [presenceConnected, planMembers, currentUser?._id]);

  // Calculate actual costs assigned to this plan item
  // Prefer live costs prop (from usePlanCosts hook) over plan.costs for real-time updates
  // NOTE: These useMemo hooks MUST be before any early returns to maintain hooks order
  const costsSource = costsProp || plan?.costs;
  const actualCosts = useMemo(() => {
    if (!costsSource || !planItem?._id) return [];
    const filtered = costsSource.filter(cost => {
      const costPlanItemId = cost.plan_item?._id || cost.plan_item;
      const planItemId = planItem._id;
      return costPlanItemId && String(costPlanItemId) === String(planItemId);
    });
    // Deduplicate by cost _id to prevent rendering duplicates
    const seen = new Set();
    return filtered.filter(cost => {
      const id = cost._id?.toString() || cost._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [costsSource, planItem?._id]);

  // Get plan currency for conversion
  const planCurrency = plan?.currency || 'USD';

  // Target currency for display - use displayCurrency if provided, otherwise plan currency
  const targetCurrency = displayCurrency || planCurrency;

  /**
   * Get converted cost amount for a single cost item
   * NOTE: ratesLoaded dependency ensures recalculation when rates become available
   * Converts from cost's tracked currency to the target display currency
   */
  const getConvertedAmount = useMemo(() => {
    return (cost) => convertCostToTarget(cost, targetCurrency);
  }, [targetCurrency, ratesLoaded]);

  const totalActualCost = useMemo(() => {
    return actualCosts.reduce((sum, cost) => sum + getConvertedAmount(cost), 0);
  }, [actualCosts, getConvertedAmount]);

  // Route a selected detail type from the dropdown / empty-state modal to
  // the right next step. Kept in the parent because the AddDetailTypeModal
  // empty-state path also needs it.
  // NOTE: This callback MUST be before early return to maintain hooks order.
  const handleSelectDetailType = useCallback((type) => {
    setSelectedDetailType(type);

    // Handle DATE type specially - open simple date modal
    if (type === DETAIL_TYPES.DATE) {
      setShowDateModal(true);
      return;
    }

    // For cost type, use legacy handler if available (backwards compatible)
    if (type === DETAIL_TYPES.COST && onAddCostForItem && !onAddDetail) {
      onAddCostForItem(planItem);
      return;
    }

    // Open the multi-step modal
    setShowAddDetailModal(true);
  }, [onAddCostForItem, onAddDetail, planItem]);

  // Handle saving detail from modal
  const handleSaveDetail = useCallback(async (payload) => {
    logger.info('[PlanItemDetailsModal] Saving detail', payload);

    if (onAddDetail) {
      await onAddDetail(payload);
    } else if (payload.type === DETAIL_TYPES.COST && onAddCostForItem) {
      // Fallback for cost type using legacy handler
      await onAddCostForItem(planItem, payload.data);
    }

    setShowAddDetailModal(false);
    setSelectedDetailType(null);
  }, [onAddDetail, onAddCostForItem, planItem]);

  // Close add detail modal
  const handleCloseAddDetailModal = useCallback(() => {
    setShowAddDetailModal(false);
    setSelectedDetailType(null);
  }, []);

  /**
   * Group all details (flights, hotels, parking, discounts, costs, etc.) by category
   * Returns an object with category keys and arrays of details
   */
  const { groupedDetails, totalDetailsCount } = useGroupedDetails(
    planItem,
    actualCosts
  );

  // BienBot Discuss action (ai_features flag guard)
  const { label: bienbotLabel, hasAccess: hasBienBot, handleOpen: handleBienBot } =
    useBienBotEntityAction('plan_item', planItemIdStr, experienceName
      ? `${planItem?.text || 'Plan Item'} in ${experienceName}`
      : planItem?.text || 'Plan Item');

  /**
   * Export details to PDF
   * Uses browser print functionality with a styled print view
   * Uses safe DOM APIs (createElement, textContent) to prevent XSS
   */
  const handleExportPDF = useCallback(() => {
    const { popupBlocked } = exportPlanItemDetailsPDF({
      planItem,
      experienceName,
      groupedDetails,
      collaborators,
    });
    if (popupBlocked) setPdfExportBlocked(true);
  }, [planItem, experienceName, groupedDetails, collaborators]);

  const {
    saveLocation,
    saveDate,
    locationForMap,
    fullCopyableAddress,
    copyAddress: handleCopyAddress,
    addressCopied,
  } = usePlanItemActions(plan, planItem);

  const handleSaveLocation = useCallback(
    async (locationData) => {
      await saveLocation(locationData);
      setShowLocationModal(false);
    },
    [saveLocation]
  );

  const handleSaveDate = useCallback(
    async (dateData) => {
      await saveDate(dateData);
      setLocalScheduledDate(dateData.scheduled_date || null);
      setLocalScheduledTime(dateData.scheduled_time || null);
      setShowDateModal(false);
    },
    [saveDate]
  );

  if (!planItem) return null;

  const notes = planItem.details?.notes || [];

  // Get planning days and cost estimate from plan item
  const planningDays = planItem.planning_days;
  const costEstimate = planItem.cost;
  // Use targetCurrency for display (user preference or plan currency)
  const currency = targetCurrency;

  // Get scheduled date/time - use local state for immediate UI feedback, fallback to prop
  // Local state is updated immediately when date is saved, prop updates when parent re-renders
  const scheduledDate = (localScheduledDate && new Date(localScheduledDate).getTime())
    ? localScheduledDate
    : (planItem.scheduled_date && new Date(planItem.scheduled_date).getTime() ? planItem.scheduled_date : null);
  const scheduledTime = localScheduledTime || planItem.scheduled_time || null;

  return (
    <>
      <Modal
        show={show}
        onClose={onClose}
        title={
          <EditableTitle
            key={planItemIdStr}
            planItem={planItem}
            canEdit={canEdit}
            onUpdateTitle={onUpdateTitle}
          />
        }
        size="fullscreen"
      centered={false}
      trapFocus={false}
      closeOnInteractOutside={false}
      allowBodyScroll={isMobileViewport}
      bodyClassName={isMobileViewport ? styles.modalBodyDocumentScroll : styles.modalBodyFullscreen}
    >
      <div
        className={`${styles.planItemDetailsModal} ${isMobileViewport ? styles.documentScrollMode : ''}`}
        onTouchStart={(onPrev || onNext) ? handleTouchStart : undefined}
        onTouchEnd={(onPrev || onNext) ? handleTouchEnd : undefined}
      >
        {/* Item navigation bar - prev/next with keyboard and swipe support */}
        <ItemNavBar onPrev={onPrev} onNext={onNext} />
        {/* Assignment + completion toggle + external URL link */}
        <AssignmentSection
          key={`assign-${planItemIdStr}`}
          planItem={planItem}
          canEdit={canEdit}
          collaborators={collaborators}
          onAssign={onAssign}
          onUnassign={onUnassign}
          onToggleComplete={onToggleComplete}
        />

        {/* Cost & Planning Info Section */}
        <CostPlanningInfoSection
          planItem={planItem}
          currentUser={currentUser}
          scheduledDate={scheduledDate}
          scheduledTime={scheduledTime}
          planningDays={planningDays}
          costEstimate={costEstimate}
          currency={currency}
          actualCosts={actualCosts}
          totalActualCost={totalActualCost}
          canEdit={canEdit}
          onShare={onShare}
          onAddCostForItem={onAddCostForItem}
          onAddDetail={onAddDetail}
          onEditDate={() => setShowDateModal(true)}
          onSelectDetailType={handleSelectDetailType}
          hasBienBot={hasBienBot}
          bienbotLabel={bienbotLabel}
          onBienBot={handleBienBot}
        />

        {/* Tab options + tabs/dropdown */}
        <TabsBar
          activeTab={activeTab}
          onChange={setActiveTab}
          totalDetailsCount={totalDetailsCount}
          notesCount={notes.length}
          hasLocation={!!planItem?.location?.address}
        />

        {/* Tab content - height calculated dynamically via JavaScript */}
        <div
          className={styles.detailsContent}
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'details' && (
            <DetailsTab
              pdfExportBlocked={pdfExportBlocked}
              onDismissPdfExportBlocked={() => setPdfExportBlocked(false)}
              totalDetailsCount={totalDetailsCount}
              groupedDetails={groupedDetails}
              onExportPDF={handleExportPDF}
              collaborators={collaborators}
              canEdit={canEdit}
              onAddCostForItem={onAddCostForItem}
              onAddDetail={onAddDetail}
              onAddDetailRequest={() => setShowDetailTypeSelectorModal(true)}
              plan={plan}
              currentUser={currentUser}
            />
          )}

          {/* NotesTab - keep mounted but hidden to preserve form state during tab switches.
               key={planItemIdStr} ensures the component fully remounts when navigating
               to a different plan item (clearing search, edit form, etc.) while still
               preserving state across tab switches within the same item. */}
          <div
            className={`${styles.notesTabWrapper} ${activeTab === 'notes' ? styles.tabWrapperActive : styles.tabWrapperHidden}`}
          >
            <PlanItemNotes
              key={planItemIdStr}
              planItemId={planItemIdStr}
              notes={notes}
              currentUser={currentUser}
              onAddNote={onAddNote}
              onUpdateNote={onUpdateNote}
              onDeleteNote={onDeleteNote}
              onVoteNoteRelevancy={onVoteNoteRelevancy}
              disabled={!canEdit}
              availableEntities={availableEntities}
              entityData={entityData}
              onEntityClick={handleEntityClick}
              presenceConnected={presenceConnected}
              onlineUserIds={onlineUserIds}
              collaborators={collaborators}
            />
          </div>

          {/* LocationTab - keep mounted but hidden to preserve map state during tab switches */}
          <div
            className={`${styles.locationTabContent} ${activeTab === 'location' ? styles.tabWrapperActive : styles.tabWrapperHidden}`}
          >
            <LocationTab
              planItem={planItem}
              locationForMap={locationForMap}
              fullCopyableAddress={fullCopyableAddress}
              addressCopied={addressCopied}
              onCopyAddress={handleCopyAddress}
              canEdit={canEdit}
              onEditLocation={() => setShowLocationModal(true)}
              onAddLocation={() => setShowLocationModal(true)}
            />
          </div>

          {activeTab === 'chat' && (
            <ChatTab
              streamApiKey={streamApiKey}
              mergedChatError={mergedChatError}
              mergedChatLoading={mergedChatLoading}
              chatShouldShowLoading={chatShouldShowLoading}
              chatClient={chatClient}
              chatChannel={chatChannel}
              uiTheme={uiTheme}
            />
          )}

          {/* PhotosTab - keep mounted but hidden to preserve state during tab switches */}
          {/* isActive gates the network fetch so background tabs don't make requests */}
          <div
            className={`${styles.photosTabWrapper} ${activeTab === 'photos' ? styles.tabWrapperActive : styles.tabWrapperHidden}`}
          >
            <PhotosTab
              planItem={planItem}
              plan={plan}
              canEdit={canEdit}
              currentUser={currentUser}
              isActive={activeTab === 'photos'}
            />
          </div>

          {/* DocumentsTab - keep mounted but hidden to preserve state during tab switches */}
          {/* isActive gates the network fetch so background tabs don't make requests */}
          <div
            className={`${styles.documentsTabWrapper} ${activeTab === 'documents' ? styles.tabWrapperActive : styles.tabWrapperHidden}`}
          >
            <DocumentsTab
              planItem={planItem}
              plan={plan}
              canEdit={canEdit}
              isActive={activeTab === 'documents'}
            />
          </div>
        </div>
      </div>

      {/* Add Plan Item Detail Modal */}
      <AddPlanItemDetailModal
        show={showAddDetailModal}
        onClose={handleCloseAddDetailModal}
        planItem={planItem}
        plan={plan}
        onSave={handleSaveDetail}
        defaultDetailType={selectedDetailType}
        defaultCurrency={plan?.currency || 'USD'}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        show={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSave={handleSaveLocation}
        initialAddress={planItem?.location?.address || ''}
        initialLocation={planItem?.location || null}
      />

      {/* Add Date Modal */}
      <AddDateModal
        show={showDateModal}
        onClose={() => setShowDateModal(false)}
        onSave={handleSaveDate}
        initialDate={planItem?.scheduled_date || null}
        initialTime={planItem?.scheduled_time || null}
        planItemText={planItem?.text || 'Plan Item'}
      />

      {/* Add Detail Type Selector Modal - for empty state "Add Details" button */}
      <AddDetailTypeModal
        show={showDetailTypeSelectorModal}
        onClose={() => setShowDetailTypeSelectorModal(false)}
        onSelectType={handleSelectDetailType}
      />
    </Modal>

    </>
  );
}
