/**
 * CostsList Component
 *
 * Displays a list of costs for a plan with add/edit/delete functionality.
 * Includes inline cost summary.
 *
 * Uses Chakra UI layout primitives + design-system Accordion/Pill/EmptyState.
 */

import { useState, useMemo, useId } from 'react';
import { Box, Flex, HStack, VStack, Text, Icon, Badge, IconButton } from '@chakra-ui/react';
import { FaDollarSign, FaPlus, FaEdit, FaTrash, FaUser, FaListUl, FaChevronDown } from 'react-icons/fa';
import { formatTrackedCost } from '../../utilities/cost-utils';
import { lang } from '../../lang.constants';
import CostEntry from '../CostEntry';
import CostSummary from '../CostSummary';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import Pagination from '../Pagination/Pagination';
import { EmptyState, Pill, Accordion, Button } from '../design-system';
import styles from './CostsList.module.css';

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
    <Box className={styles.costsSection}>
      {/* Tracked Costs Accordion - collapsed by default */}
      {/* Contains: Cost Summary (Total/Export/Per Person) + Costs List */}
      {/* NOTE: Add Cost button is rendered outside Accordion.Header (which is a <button>) to
           avoid the invalid nested <button> DOM structure. It is absolutely positioned to
           visually align with the header area. */}
      <Box position="relative">
      <Accordion
        activeKey={isAccordionOpen ? accordionId : null}
        onSelect={(key) => setIsAccordionOpen(key === accordionId)}
        className={styles.trackedCostsAccordion}
      >
        <Accordion.Item eventKey={accordionId}>
          <Accordion.Header className={styles.accordionHeader}>
            <HStack gap="var(--space-2)" flex="0 1 auto">
              <Icon
                as={FaChevronDown}
                className={`${styles.accordionIcon} ${isAccordionOpen ? styles.accordionIconOpen : ''}`}
                color="var(--color-text-muted)"
                fontSize="var(--font-size-sm)"
              />
              <Icon as={FaDollarSign} color="var(--color-primary)" />
              <Text
                as="span"
                fontWeight="var(--font-weight-semibold)"
                fontSize="var(--font-size-lg)"
                color="var(--color-text-primary)"
              >
                {costStrings.trackedCosts || 'Tracked Costs'}
              </Text>
              <Pill variant="neutral" size="sm">{costs.length}</Pill>
            </HStack>
          </Accordion.Header>
          <Accordion.Body className={styles.accordionBody}>
            {/* Cost Summary - Total/Export CSV/Per Person Share */}
            {showSummary && costs.length > 0 && (
              <Box marginBottom="var(--space-4)">
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
              </Box>
            )}
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
                <VStack gap="var(--space-3)" align="stretch" id={listId}>
                  {paginatedCosts.map((cost) => {
                    const collaboratorName = getCollaboratorName(cost.collaborator);
                    const planItemText = getPlanItemText(cost.plan_item);

                    return (
                      <Flex
                        key={cost._id}
                        className={styles.costItem}
                        justify="space-between"
                        align="flex-start"
                        padding="var(--space-3)"
                        bg="var(--color-bg-primary)"
                        borderRadius="var(--radius-md)"
                        border="1px solid"
                        borderColor="var(--color-border-light)"
                        transition="var(--transition-fast)"
                        _hover={{
                          borderColor: 'var(--color-border-medium)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        direction={{ base: 'column', sm: 'row' }}
                        gap={{ base: 'var(--space-3)', sm: '0' }}
                      >
                        <Box flex="1" minWidth="0">
                          <Text
                            fontWeight="var(--font-weight-semibold)"
                            color="var(--color-text-primary)"
                            marginBottom="var(--space-1)"
                          >
                            {cost.title}
                          </Text>
                          {cost.description && (
                            <Text
                              fontSize="var(--font-size-sm)"
                              color="var(--color-text-secondary)"
                              marginBottom="var(--space-2)"
                              lineClamp={2}
                            >
                              {cost.description}
                            </Text>
                          )}
                          <HStack gap="var(--space-2)" flexWrap="wrap">
                            {collaboratorName && (
                              <Badge
                                className={styles.metaBadge}
                                variant="subtle"
                                fontSize="var(--font-size-xs)"
                              >
                                <Icon as={FaUser} fontSize="0.7rem" opacity={0.7} />
                                {collaboratorName}
                              </Badge>
                            )}
                            {planItemText && (
                              <Badge
                                className={styles.metaBadge}
                                variant="subtle"
                                fontSize="var(--font-size-xs)"
                              >
                                <Icon as={FaListUl} fontSize="0.7rem" opacity={0.7} />
                                {planItemText}
                              </Badge>
                            )}
                            {!collaboratorName && (
                              <Badge
                                className={styles.sharedBadge}
                                colorPalette="blue"
                                variant="subtle"
                                fontSize="var(--font-size-xs)"
                              >
                                {costStrings.sharedCost}
                              </Badge>
                            )}
                          </HStack>
                        </Box>

                        <HStack
                          gap="var(--space-3)"
                          flexShrink={0}
                          width={{ base: '100%', sm: 'auto' }}
                          justify={{ base: 'space-between', sm: 'flex-end' }}
                        >
                          <Text
                            fontSize="var(--font-size-lg)"
                            fontWeight="var(--font-weight-bold)"
                            color="var(--color-primary)"
                            whiteSpace="nowrap"
                          >
                            {/* Display individual costs in their original tracked currency with disambiguated symbol */}
                            {formatTrackedCost(cost.cost, { currency: cost.currency || 'USD' })}
                          </Text>

                          {canEdit && (
                            <HStack gap="var(--space-1)" className={styles.costItemActions}>
                              <IconButton
                                aria-label={lang.current.tooltip.edit}
                                title={lang.current.tooltip.edit}
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditCost(cost)}
                              >
                                <Icon as={FaEdit} />
                              </IconButton>
                              <IconButton
                                aria-label={lang.current.tooltip.delete}
                                title={lang.current.tooltip.delete}
                                variant="outline"
                                colorPalette="red"
                                size="sm"
                                onClick={() => handleDeleteClick(cost)}
                              >
                                <Icon as={FaTrash} />
                              </IconButton>
                            </HStack>
                          )}
                        </HStack>
                      </Flex>
                    );
                  })}
                </VStack>

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
      {canEdit && (
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleAddCost}
          className={styles.accordionHeaderAction}
        >
          <Icon as={FaPlus} marginRight="var(--space-1)" />
          {costStrings.addCost}
        </Button>
      )}
      </Box>

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
    </Box>
  );
}
