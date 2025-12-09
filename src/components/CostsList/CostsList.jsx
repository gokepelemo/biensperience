/**
 * CostsList Component
 *
 * Displays a list of costs for a plan with add/edit/delete functionality.
 * Includes inline cost summary.
 */

import { useState, useMemo, useId } from 'react';
import { Accordion } from 'react-bootstrap';
import { FaDollarSign, FaPlus, FaEdit, FaTrash, FaUser, FaListUl, FaChevronDown } from 'react-icons/fa';
import { formatTrackedCost } from '../../utilities/cost-utils';
import { lang } from '../../lang.constants';
import CostEntry from '../CostEntry';
import CostSummary from '../CostSummary';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import Pagination from '../Pagination/Pagination';
import { EmptyState, Pill } from '../design-system';
import styles from './CostsList.module.scss';

const COSTS_PER_PAGE = 10;

export default function CostsList({
  // Plan data
  planId,
  costs = [],
  costSummary = null,
  collaborators = [], // Array of { _id, name } for dropdowns
  planItems = [], // Array of { _id, text } for dropdowns

  // Currency for the plan (defaults to USD)
  currency = 'USD',

  // Display currency - if different from plan currency, all amounts will be converted
  // This allows displaying in user's preferred currency while tracking in plan currency
  displayCurrency,

  // Permissions
  canEdit = false,

  // Callbacks
  onAddCost,
  onUpdateCost,
  onDeleteCost,

  // UI state
  loading = false,

  // Display options
  showSummary = true,
  compact = false,

  // Real-time presence for online indicators
  presenceConnected = false,
  onlineUserIds = new Set()
}) {
  const listId = useId();
  const accordionId = useId();
  const costStrings = lang.current.cost;

  // Determine the target currency for rollup display (CostSummary)
  // If displayCurrency is provided (user preference), use that; otherwise use plan currency
  const targetCurrency = displayCurrency || currency;

  // Modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [costToDelete, setCostToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Accordion state - collapsed by default
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(costs.length / COSTS_PER_PAGE);

  // Get paginated costs
  const paginatedCosts = useMemo(() => {
    const startIndex = (currentPage - 1) * COSTS_PER_PAGE;
    return costs.slice(startIndex, startIndex + COSTS_PER_PAGE);
  }, [costs, currentPage]);

  // Reset to page 1 when costs change significantly
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Lookup maps for display
  const collaboratorMap = useMemo(() => {
    const map = {};
    collaborators.forEach(c => {
      map[c._id] = c;
    });
    return map;
  }, [collaborators]);

  const planItemMap = useMemo(() => {
    const map = {};
    planItems.forEach(item => {
      map[item._id] = item;
    });
    return map;
  }, [planItems]);

  // Open add cost modal
  const handleAddCost = () => {
    setEditingCost(null);
    setShowCostModal(true);
  };

  // Open edit cost modal
  const handleEditCost = (cost) => {
    setEditingCost(cost);
    setShowCostModal(true);
  };

  // Save cost (add or update)
  const handleSaveCost = async (costData) => {
    setModalLoading(true);
    try {
      if (editingCost?._id) {
        // Update existing
        await onUpdateCost?.(planId, editingCost._id, costData);
      } else {
        // Add new
        await onAddCost?.(planId, costData);
      }
      setShowCostModal(false);
      setEditingCost(null);
    } catch {
      // Error handling is done in parent
    } finally {
      setModalLoading(false);
    }
  };

  // Confirm delete
  const handleDeleteClick = (cost) => {
    setCostToDelete(cost);
    setShowDeleteConfirm(true);
  };

  // Execute delete
  const handleConfirmDelete = async () => {
    if (!costToDelete) return;

    setModalLoading(true);
    try {
      await onDeleteCost?.(planId, costToDelete._id);
      setShowDeleteConfirm(false);
      setCostToDelete(null);
    } catch {
      // Error handling is done in parent
    } finally {
      setModalLoading(false);
    }
  };

  // Close modals
  const handleCloseModal = () => {
    setShowCostModal(false);
    setEditingCost(null);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setCostToDelete(null);
  };

  // Get display name for collaborator
  const getCollaboratorName = (collaboratorId) => {
    if (!collaboratorId) return null;
    const id = collaboratorId._id || collaboratorId;
    const collab = collaboratorMap[id];
    return collab?.name || collab?.email || 'Unknown';
  };

  // Get display text for plan item
  const getPlanItemText = (planItemId) => {
    if (!planItemId) return null;
    const id = planItemId._id || planItemId;
    const item = planItemMap[id];
    return item?.text || 'Unknown item';
  };

  // No early return - always show collapsible Tracked Costs section

  return (
    <div className={styles.costsSection}>
      {/* Cost Summary */}
      {showSummary && costs.length > 0 && (
        <div className={styles.summaryWrapper}>
          <CostSummary
            summary={costSummary}
            costs={costs}
            collaborators={collaborators}
            planItems={planItems}
            currency={targetCurrency}
            compact={compact}
            showBreakdowns={!compact}
            presenceConnected={presenceConnected}
            onlineUserIds={onlineUserIds}
          />
        </div>
      )}

      {/* Tracked Costs Accordion - collapsed by default */}
      <Accordion
        activeKey={isAccordionOpen ? accordionId : null}
        onSelect={(key) => setIsAccordionOpen(key === accordionId)}
        className={styles.trackedCostsAccordion}
      >
        <Accordion.Item eventKey={accordionId}>
          <Accordion.Header className={styles.accordionHeader}>
            <div className={styles.accordionHeaderLeft}>
              <FaChevronDown className={`${styles.accordionIcon} ${isAccordionOpen ? styles.accordionIconOpen : ''}`} />
              <FaDollarSign className={styles.sectionIcon} />
              <span className={styles.accordionTitle}>{costStrings.trackedCosts || 'Tracked Costs'}</span>
              <Pill variant="secondary" size="sm">{costs.length}</Pill>
            </div>
            {canEdit && (
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddCost();
                }}
                type="button"
              >
                <FaPlus className="me-1" />
                {costStrings.addCost}
              </button>
            )}
          </Accordion.Header>
          <Accordion.Body className={styles.accordionBody}>
            {costs.length === 0 ? (
              /* Empty State */
              <EmptyState
                variant="generic"
                icon="💰"
                title={costStrings.noCostsYet}
                description={null}
                primaryAction={canEdit ? costStrings.addFirstCost : null}
                onPrimaryAction={canEdit ? handleAddCost : null}
                size="sm"
                compact={true}
              />
            ) : (
              /* Costs List */
              <>
                <div className={styles.costsList} id={listId}>
                  {paginatedCosts.map((cost) => {
                const collaboratorName = getCollaboratorName(cost.collaborator);
                const planItemText = getPlanItemText(cost.plan_item);

                return (
                  <div key={cost._id} className={styles.costItem}>
                    <div className={styles.costItemContent}>
                      <div className={styles.costItemTitle}>{cost.title}</div>
                      {cost.description && (
                        <div className={styles.costItemDescription}>
                          {cost.description}
                        </div>
                      )}
                      <div className={styles.costItemMeta}>
                        {collaboratorName && (
                          <span className={styles.metaBadge}>
                            <FaUser className={styles.metaIcon} />
                            {collaboratorName}
                          </span>
                        )}
                        {planItemText && (
                          <span className={styles.metaBadge}>
                            <FaListUl className={styles.metaIcon} />
                            {planItemText}
                          </span>
                        )}
                        {!collaboratorName && (
                          <span className={styles.sharedBadge}>
                            {costStrings.sharedCost}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.costItemRight}>
                      <div className={styles.costItemAmount}>
                        {/* Display individual costs in their original tracked currency with disambiguated symbol */}
                        {formatTrackedCost(cost.cost, { currency: cost.currency || 'USD' })}
                      </div>

                      {canEdit && (
                        <div className={styles.costItemActions}>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEditCost(cost)}
                            type="button"
                            title={lang.current.tooltip.edit}
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDeleteClick(cost)}
                            type="button"
                            title={lang.current.tooltip.delete}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalResults={costs.length}
                    resultsPerPage={COSTS_PER_PAGE}
                    variant="compact"
                    showResultsInfo={true}
                  />
                )}
              </>
            )}
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      {/* Add/Edit Cost Modal */}
      <CostEntry
        show={showCostModal}
        onHide={handleCloseModal}
        editingCost={editingCost}
        collaborators={collaborators}
        planItems={planItems}
        onSave={handleSaveCost}
        loading={modalLoading}
        defaultCurrency={currency}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title={lang.current.button.delete}
        message={costStrings.confirmDeleteCost}
        confirmText={lang.current.button.delete}
        confirmVariant="danger"
        loading={modalLoading}
      />
    </div>
  );
}
