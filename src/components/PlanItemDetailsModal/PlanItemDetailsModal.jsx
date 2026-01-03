/**
 * PlanItemDetailsModal Component
 * Modal for viewing and managing all details of a plan item (notes, assignment, etc.)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dropdown } from 'react-bootstrap';
import { FaPlus, FaShareAlt, FaFilePdf, FaMapMarkerAlt, FaCopy, FaCheck, FaChevronDown } from 'react-icons/fa';
import {
  Chat,
  Channel,
  MessageInput,
  MessageList,
  Thread,
  Window
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Loading from '../Loading/Loading';
import PlanItemNotes from '../PlanItemNotes/PlanItemNotes';
import AddPlanItemDetailModal, { DETAIL_TYPES, DETAIL_TYPE_CONFIG, DETAIL_CATEGORIES } from '../AddPlanItemDetailModal';
import AddLocationModal from '../AddLocationModal';
import AddDateModal from '../AddDateModal';
import GoogleMap from '../GoogleMap/GoogleMap';
import EmptyState from '../EmptyState/EmptyState';
import Alert from '../Alert/Alert';
import DocumentsTab from './DocumentsTab';
import PhotosTab from './PhotosTab';
import styles from './PlanItemDetailsModal.module.scss';
import { createSimpleFilter } from '../../utilities/trie';
import { logger } from '../../utilities/logger';
import { formatPlanningTime, getPlanningTimeTooltip } from '../../utilities/planning-time-utils';
import { formatCostEstimate, formatActualCost, getCostEstimateTooltip, getTrackedCostTooltip } from '../../utilities/cost-utils';
import { convertCostToTarget, fetchRates } from '../../utilities/currency-conversion';
import { updatePlanItem } from '../../utilities/plans-api';
import { broadcastEvent } from '../../utilities/event-bus';
import { lang } from '../../lang.constants';
import { sanitizeUrl } from '../../utilities/sanitize';
import Tooltip from '../Tooltip/Tooltip';
import { getOrCreatePlanItemChannel } from '../../utilities/chat-api';
import useStreamChat from '../../hooks/useStreamChat';

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
  // Callback for sharing a plan item - called with planItem
  onShare,
  // Real-time presence for online indicators
  presenceConnected = false,
  planMembers = [],
  // Experience name for PDF export title
  experienceName = ''
}) {
  const streamApiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY;

  const [uiTheme, setUiTheme] = useState(() => {
    try {
      const root = document?.documentElement;
      const theme = root?.getAttribute('data-theme') || root?.getAttribute('data-bs-theme');
      return theme === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  // Keep Stream Chat theme aligned with app theme while modal is open.
  useEffect(() => {
    if (!show) return undefined;

    try {
      const root = document?.documentElement;
      if (!root || !window?.MutationObserver) return undefined;

      const updateTheme = () => {
        try {
          const theme = root.getAttribute('data-theme') || root.getAttribute('data-bs-theme');
          setUiTheme(theme === 'dark' ? 'dark' : 'light');
        } catch (e) {
          // ignore
        }
      };

      updateTheme();

      const observer = new MutationObserver(updateTheme);
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-bs-theme']
      });

      return () => observer.disconnect();
    } catch (e) {
      return undefined;
    }
  }, [show]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [filteredCollaborators, setFilteredCollaborators] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');
  const [ratesLoaded, setRatesLoaded] = useState(false);
  // Add dropdown state
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [addDropdownFilter, setAddDropdownFilter] = useState('');
  const [showAddDetailModal, setShowAddDetailModal] = useState(false);
  const [selectedDetailType, setSelectedDetailType] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  // Local state for immediate UI feedback on scheduled date/time changes
  const [localScheduledDate, setLocalScheduledDate] = useState(null);
  const [localScheduledTime, setLocalScheduledTime] = useState(null);

  // Plan item chat state (rendered ONLY in this modal's Chat tab)
  const [chatChannel, setChatChannel] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const assignmentInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const titleInputRef = useRef(null);
  const addDropdownRef = useRef(null);
  const addDropdownFilterRef = useRef(null);

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

  const canInitChat = useMemo(() => {
    return Boolean(show && activeTab === 'chat' && streamApiKey && plan?._id && planItemIdStr);
  }, [show, activeTab, streamApiKey, plan?._id, planItemIdStr]);

  const {
    client: chatClient,
    loading: chatClientLoading,
    error: chatClientError
  } = useStreamChat({
    connectWhen: canInitChat,
    disconnectWhen: !show,
    apiKey: streamApiKey,
    context: 'PlanItemDetailsModal'
  });

  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      if (!canInitChat) return;

      // The Stream client initializes asynchronously. Wait until it's available
      // before trying to create/watch a channel.
      if (!chatClient || typeof chatClient.channel !== 'function') return;

      // Skip if already connected (connection persists across tab switches)
      if (chatClient && chatChannel) return;

      setChatLoading(true);
      setChatError('');

      try {
        // Ensure a plan-item scoped group channel exists
        const planId = normalizeId(plan?._id);
        const planItemId = planItemIdStr;

        const { id: channelId } = await getOrCreatePlanItemChannel(planId, planItemId);

        const streamChannel = chatClient.channel('messaging', channelId);
        await streamChannel.watch();

        if (!cancelled) setChatChannel(streamChannel);
      } catch (err) {
        logger.error('[PlanItemDetailsModal] Failed to initialize plan item chat', err);
        if (!cancelled) {
          setChatError(err?.message || 'Failed to initialize chat');
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }

    initChat();

    return () => {
      cancelled = true;
    };
    // We check chatClient/chatChannel to skip if already connected.
    // This prevents reconnection when switching tabs since we keep connection alive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canInitChat, chatClient, chatChannel, plan?._id, planItemIdStr]);

  // Cleanup chat connection when modal closes
  // NOTE: We only disconnect when the modal closes, NOT when switching tabs.
  // This prevents the "can't use channel after disconnect" error when using Thread.
  // The chat connection stays alive while the modal is open (even on other tabs).
  useEffect(() => {
    // Only cleanup when modal is closing
    if (show) return;

    // Clear state immediately to unmount Stream components first
    setChatChannel(null);
    setChatError('');
    setChatLoading(false);
  }, [show]);

  const mergedChatError = chatClientError || chatError;
  const mergedChatLoading = chatClientLoading || chatLoading;

  // Track what we've initialized for - only reset on ACTUAL changes
  const initializedForRef = useRef({ show: false, planItemId: null });

  // Reset to specified initial tab when modal opens or a DIFFERENT plan item is selected
  // This effect should ONLY run when show or planItemId actually changes value
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
      setIsEditingAssignment(false);
      setAssignmentSearch('');
      setIsEditingTitle(false);
      setTitleText(planItem?.text || '');
      setShowAddDropdown(false);
      setShowLocationModal(false);
      setShowDateModal(false);
      setLocalScheduledDate(planItem?.scheduled_date || null);
      setLocalScheduledTime(planItem?.scheduled_time || null);
    }
    // NOTE: We intentionally exclude planItemIdStr from dependencies because we track it via ref
    // This prevents the effect from running on every planItem prop update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initialTab]);

  // Handle click outside for add dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        addDropdownRef.current &&
        !addDropdownRef.current.contains(event.target)
      ) {
        setShowAddDropdown(false);
      }
    };

    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddDropdown]);

  // Clear filter and focus input when Add dropdown opens
  useEffect(() => {
    if (showAddDropdown) {
      setAddDropdownFilter('');
      // Focus filter input after dropdown renders
      requestAnimationFrame(() => {
        addDropdownFilterRef.current?.focus();
      });
    }
  }, [showAddDropdown]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (canEdit && onUpdateTitle) {
      setTitleText(planItem?.text || '');
      setIsEditingTitle(true);
    }
  }, [canEdit, onUpdateTitle, planItem?.text]);

  // Handle title blur to save
  const handleTitleBlur = useCallback(async () => {
    setIsEditingTitle(false);
    const trimmedTitle = titleText.trim();
    // Only save if title changed and is not empty
    if (trimmedTitle && trimmedTitle !== planItem?.text && onUpdateTitle) {
      try {
        await onUpdateTitle(trimmedTitle);
      } catch (error) {
        logger.error('[PlanItemDetailsModal] Failed to update title', { error });
        // Revert to original on error
        setTitleText(planItem?.text || '');
      }
    } else {
      // Revert to original if empty or unchanged
      setTitleText(planItem?.text || '');
    }
  }, [titleText, planItem?.text, onUpdateTitle]);

  // Handle title key events
  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleText(planItem?.text || '');
      setIsEditingTitle(false);
    }
  }, [planItem?.text]);

  // Build trie index for fast collaborator search
  const collaboratorTrieFilter = useMemo(() => {
    if (!collaborators || collaborators.length === 0) return null;
    // Normalize collaborators to have a 'name' field for trie indexing
    const normalizedCollabs = collaborators.map(collab => ({
      ...collab,
      name: collab.name || collab.user?.name || ''
    }));
    return createSimpleFilter(['name']).buildIndex(normalizedCollabs);
  }, [collaborators]);

  // Build detail type items array and trie filter for the Add dropdown
  const detailTypeItems = useMemo(() => {
    return Object.entries(DETAIL_TYPE_CONFIG).map(([type, config]) => ({
      type,
      label: config.label,
      icon: config.icon,
      description: config.description || ''
    }));
  }, []);

  const detailTypeTrieFilter = useMemo(() => {
    // Index by label and description for comprehensive search
    return createSimpleFilter(['label', 'description']).buildIndex(detailTypeItems);
  }, [detailTypeItems]);

  // Filter detail types based on dropdown filter input using trie
  const filteredDetailTypes = useMemo(() => {
    if (addDropdownFilter.trim() === '') {
      return detailTypeItems;
    }
    return detailTypeTrieFilter.filter(addDropdownFilter, { rankResults: true });
  }, [addDropdownFilter, detailTypeItems, detailTypeTrieFilter]);

  // Filter collaborators based on search using trie
  useEffect(() => {
    if (assignmentSearch.trim() === '') {
      setFilteredCollaborators(collaborators);
    } else if (collaboratorTrieFilter) {
      // Use trie for O(m) filtering
      const filtered = collaboratorTrieFilter.filter(assignmentSearch, { rankResults: true });
      setFilteredCollaborators(filtered);
    } else {
      // Fallback to linear search
      const searchLower = assignmentSearch.toLowerCase();
      const filtered = collaborators.filter(collab => {
        const name = collab.name || collab.user?.name || '';
        return name.toLowerCase().includes(searchLower);
      });
      setFilteredCollaborators(filtered);
    }
    setHighlightedIndex(0);
  }, [assignmentSearch, collaborators, collaboratorTrieFilter]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingAssignment && assignmentInputRef.current) {
      assignmentInputRef.current.focus();
    }
  }, [isEditingAssignment]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        assignmentInputRef.current &&
        !assignmentInputRef.current.contains(event.target)
      ) {
        setIsEditingAssignment(false);
        setAssignmentSearch('');
      }
    };

    if (isEditingAssignment) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditingAssignment]);


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

  // Calculate actual costs assigned to this plan item from plan.costs
  // NOTE: These useMemo hooks MUST be before any early returns to maintain hooks order
  const actualCosts = useMemo(() => {
    if (!plan?.costs || !planItem?._id) return [];
    const filtered = plan.costs.filter(cost => {
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
  }, [plan?.costs, planItem?._id]);

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

  // Handle add dropdown toggle
  // NOTE: These callbacks MUST be before early return to maintain hooks order
  const handleToggleAddDropdown = useCallback(() => {
    setShowAddDropdown(prev => !prev);
  }, []);

  // Handle selecting a detail type from dropdown
  const handleSelectDetailType = useCallback((type) => {
    setSelectedDetailType(type);
    setShowAddDropdown(false);

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
  const groupedDetails = useMemo(() => {
    if (!planItem?.details) return {};

    const groups = {};

    // Process each detail type that exists on the plan item
    // EXCLUDE COST type here - costs are handled separately via actualCosts (from plan.costs)
    // to avoid duplicates and ensure we use the canonical cost data
    Object.entries(DETAIL_TYPE_CONFIG).forEach(([type, config]) => {
      // Skip cost type - handled below via actualCosts
      if (type === DETAIL_TYPES.COST) return;

      const detailsArray = planItem.details[type] || [];
      if (detailsArray.length > 0) {
        const category = config.category;
        if (!groups[category]) {
          groups[category] = {
            ...DETAIL_CATEGORIES[category],
            items: []
          };
        }
        detailsArray.forEach(detail => {
          groups[category].items.push({
            ...detail,
            type,
            typeConfig: config
          });
        });
      }
    });

    // Include tracked costs in the expense category (from plan.costs, the canonical source)
    if (actualCosts.length > 0) {
      const category = 'expense';
      if (!groups[category]) {
        groups[category] = {
          ...DETAIL_CATEGORIES[category],
          items: []
        };
      }
      actualCosts.forEach(cost => {
        groups[category].items.push({
          ...cost,
          type: DETAIL_TYPES.COST,
          typeConfig: DETAIL_TYPE_CONFIG[DETAIL_TYPES.COST]
        });
      });
    }

    // Sort groups by category order
    const sortedGroups = {};
    Object.entries(groups)
      .sort((a, b) => (a[1].order || 99) - (b[1].order || 99))
      .forEach(([key, value]) => {
        sortedGroups[key] = value;
      });

    return sortedGroups;
  }, [planItem?.details, actualCosts]);

  // Count total details for the tab badge
  const totalDetailsCount = useMemo(() => {
    return Object.values(groupedDetails).reduce((sum, group) => sum + group.items.length, 0);
  }, [groupedDetails]);

  /**
   * Export details to PDF
   * Uses browser print functionality with a styled print view
   * Uses safe DOM APIs (createElement, textContent) to prevent XSS
   */
  const handleExportPDF = useCallback(() => {
    // Helper to create element with text content (XSS-safe)
    const createEl = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = String(text);
      return el;
    };

    // Helper to add a meta row to the dl element
    const addMetaRow = (dl, label, value) => {
      if (value) {
        dl.appendChild(createEl('dt', null, `${label}:`));
        dl.appendChild(createEl('dd', null, String(value)));
      }
    };

    // Helper to get collaborator name by ID
    const getCollaboratorNameById = (collabId) => {
      if (!collabId || !collaborators || collaborators.length === 0) return null;
      const collab = collaborators.find(c => {
        const id = c._id || c.user?._id;
        return id === collabId || id?.toString() === collabId?.toString();
      });
      return collab ? (collab.name || collab.user?.name) : null;
    };

    // Get display fields for each detail type (mirrors UI)
    const getDisplayFields = (item) => {
      const fields = [];
      const type = item.type;

      if (type === DETAIL_TYPES.COST) {
        // Show amount with original currency
        if (item.cost !== undefined && item.cost !== null) {
          const originalCurrency = item.currency || 'USD';
          fields.push({ label: 'Amount', value: formatActualCost(item.cost, { currency: originalCurrency, exact: true }) });
        }
        // Show category if present
        if (item.category) fields.push({ label: 'Category', value: item.category });
        // Show who paid (collaborator name or "Shared Cost")
        if (item.collaborator) {
          const collabName = getCollaboratorNameById(item.collaborator);
          if (collabName) {
            fields.push({ label: 'Paid for', value: collabName });
          }
        } else {
          fields.push({ label: 'Type', value: 'Shared Cost' });
        }
      } else if (type === DETAIL_TYPES.FLIGHT) {
        if (item.airline) fields.push({ label: 'Airline', value: item.airline });
        if (item.flight_number) fields.push({ label: 'Flight', value: item.flight_number });
        if (item.departure_date) fields.push({ label: 'Departure', value: `${item.departure_date} ${item.departure_time || ''}`.trim() });
        if (item.confirmation_number) fields.push({ label: 'Confirmation', value: item.confirmation_number });
      } else if (type === DETAIL_TYPES.HOTEL) {
        if (item.hotel_name) fields.push({ label: 'Hotel', value: item.hotel_name });
        if (item.check_in) fields.push({ label: 'Check-in', value: item.check_in });
        if (item.check_out) fields.push({ label: 'Check-out', value: item.check_out });
        if (item.confirmation_number) fields.push({ label: 'Confirmation', value: item.confirmation_number });
      } else if ([DETAIL_TYPES.TRAIN, DETAIL_TYPES.BUS, DETAIL_TYPES.FERRY, DETAIL_TYPES.CRUISE].includes(type)) {
        if (item.departure_station) fields.push({ label: 'From', value: item.departure_station });
        if (item.arrival_station) fields.push({ label: 'To', value: item.arrival_station });
        if (item.departure_date) fields.push({ label: 'Date', value: `${item.departure_date} ${item.departure_time || ''}`.trim() });
        if (item.confirmation_number) fields.push({ label: 'Confirmation', value: item.confirmation_number });
      } else if (type === DETAIL_TYPES.PARKING) {
        if (item.location) fields.push({ label: 'Location', value: item.location });
        if (item.start_date) fields.push({ label: 'Start', value: item.start_date });
        if (item.end_date) fields.push({ label: 'End', value: item.end_date });
        if (item.confirmation_number) fields.push({ label: 'Confirmation', value: item.confirmation_number });
      } else if (type === DETAIL_TYPES.DISCOUNT) {
        if (item.code) fields.push({ label: 'Code', value: item.code });
        if (item.discount_amount) fields.push({ label: 'Discount', value: `${item.discount_amount}${item.discount_type === 'percentage' ? '%' : ''}` });
        if (item.expiry_date) fields.push({ label: 'Expires', value: item.expiry_date });
        if (item.terms) fields.push({ label: 'Terms', value: item.terms });
      }

      // Notes field for any type
      if (item.notes) fields.push({ label: 'Notes', value: item.notes });

      return fields;
    };

    // Create printable document structure using safe DOM APIs
    const printContent = document.createElement('div');

    // Add print styles (static content, no user data)
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .print-header { margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
        .print-title { font-size: 24px; font-weight: bold; margin: 0 0 8px 0; }
        .print-subtitle { font-size: 14px; color: #666; margin: 0; }
        .print-category { margin-bottom: 24px; }
        .print-category-title { font-size: 18px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
        .print-item { padding: 12px; margin-bottom: 8px; background: #f5f5f5; border-radius: 8px; }
        .print-item-type { font-size: 12px; color: #666; margin-bottom: 4px; }
        .print-item-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
        .print-item-meta { font-size: 12px; color: #666; }
        .print-item-meta dt { font-weight: 500; display: inline; }
        .print-item-meta dd { display: inline; margin: 0 16px 0 4px; }
      }
    `;
    printContent.appendChild(style);

    // Header (user data via textContent)
    const header = createEl('div', 'print-header');
    const itemName = planItem?.text || 'Plan Item';
    const titleText = experienceName ? `${experienceName} - ${itemName}` : itemName;
    header.appendChild(createEl('h1', 'print-title', titleText));
    header.appendChild(createEl('p', 'print-subtitle', `Exported on ${new Date().toLocaleDateString()}`));
    printContent.appendChild(header);

    // Categories and items (all user data via textContent)
    Object.entries(groupedDetails).forEach(([, category]) => {
      const categoryDiv = createEl('div', 'print-category');
      categoryDiv.appendChild(createEl('h2', 'print-category-title', `${category.icon} ${category.label}`));

      category.items.forEach(item => {
        const itemDiv = createEl('div', 'print-item');
        itemDiv.appendChild(createEl('div', 'print-item-type', `${item.typeConfig.icon} ${item.typeConfig.label}`));
        itemDiv.appendChild(createEl('div', 'print-item-title', item.title || item.name || item.confirmation_number || item.airline || item.hotel_name || 'Detail'));

        const dl = document.createElement('dl');
        dl.className = 'print-item-meta';

        // Use type-specific display fields (same as UI)
        const displayFields = getDisplayFields(item);
        displayFields.forEach(field => {
          addMetaRow(dl, field.label, field.value);
        });

        itemDiv.appendChild(dl);
        categoryDiv.appendChild(itemDiv);
      });

      printContent.appendChild(categoryDiv);
    });

    // Open print dialog using safe DOM serialization
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Set the document title (shows in tab and PDF filename)
      // Include experience name if available for better context
      printWindow.document.title = titleText;

      // Use DOM methods instead of document.write for safety
      printWindow.document.body.appendChild(printContent.cloneNode(true));
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
  }, [planItem?.text, experienceName, groupedDetails, targetCurrency, getConvertedAmount, collaborators]);

  /**
   * Handle saving location from AddLocationModal
   * Updates the plan item via PATCH and emits event
   */
  const handleSaveLocation = useCallback(async (locationData) => {
    if (!plan?._id || !planItem?._id) {
      throw new Error('Missing plan or plan item ID');
    }

    setLocationSaving(true);

    try {
      // Update plan item with new location via PATCH
      const result = await updatePlanItem(plan._id, planItem._id, {
        location: locationData
      });

      logger.info('[PlanItemDetailsModal] Location saved successfully', {
        planId: plan._id,
        itemId: planItem._id,
        location: locationData.address
      });

      // Emit event to update UI
      broadcastEvent('plan:item:updated', {
        planId: plan._id,
        planItemId: planItem._id,
        planItem: result,
        updatedFields: ['location']
      });

      setShowLocationModal(false);
    } catch (err) {
      logger.error('[PlanItemDetailsModal] Failed to save location', { error: err.message });
      throw err; // Let AddLocationModal handle the error display
    } finally {
      setLocationSaving(false);
    }
  }, [plan?._id, planItem?._id]);

  /**
   * Handle saving date from AddDateModal
   * Updates the plan item via PATCH and emits event
   */
  const handleSaveDate = useCallback(async (dateData) => {
    if (!plan?._id || !planItem?._id) {
      throw new Error('Missing plan or plan item ID');
    }

    try {
      // Update plan item with new scheduled date/time via PATCH
      await updatePlanItem(plan._id, planItem._id, {
        scheduled_date: dateData.scheduled_date,
        scheduled_time: dateData.scheduled_time
      });

      logger.info('[PlanItemDetailsModal] Date saved successfully', {
        planId: plan._id,
        itemId: planItem._id,
        scheduledDate: dateData.scheduled_date,
        scheduledTime: dateData.scheduled_time
      });

      // Update local state immediately for UI feedback (Scheduled card appears instantly)
      setLocalScheduledDate(dateData.scheduled_date || null);
      setLocalScheduledTime(dateData.scheduled_time || null);

      // The updatePlanItem utility already broadcasts events, so no need to emit again
      setShowDateModal(false);
    } catch (err) {
      logger.error('[PlanItemDetailsModal] Failed to save date', { error: err.message });
      throw err; // Let AddDateModal handle the error display
    }
  }, [plan?._id, planItem?._id]);

  /**
   * Get location string for Google Map
   */
  const getLocationForMap = useCallback(() => {
    const location = planItem?.location;
    if (!location) return null;

    // If we have coordinates, use them
    if (location.geo?.coordinates?.length === 2) {
      const [lng, lat] = location.geo.coordinates;
      return `${lat},${lng}`;
    }

    // Fall back to address
    return location.address || null;
  }, [planItem?.location]);

  /**
   * Get full formatted address for copying
   * Combines address with city, state, country for a complete copyable string
   */
  const getFullCopyableAddress = useCallback(() => {
    const location = planItem?.location;
    if (!location?.address) return '';

    // Build full address string
    const parts = [location.address];
    const locationParts = [location.city, location.state, location.country].filter(Boolean);
    if (locationParts.length > 0) {
      parts.push(locationParts.join(', '));
    }
    if (location.postalCode) {
      parts.push(location.postalCode);
    }

    return parts.join(', ');
  }, [planItem?.location]);

  /**
   * Handle copying address to clipboard
   */
  const handleCopyAddress = useCallback(async () => {
    const address = getFullCopyableAddress();
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
      logger.debug('[PlanItemDetailsModal] Address copied to clipboard', { address });

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setAddressCopied(false);
      }, 2000);
    } catch (err) {
      logger.error('[PlanItemDetailsModal] Failed to copy address', { error: err.message });
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = address;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setAddressCopied(true);
        setTimeout(() => setAddressCopied(false), 2000);
      } catch (fallbackErr) {
        logger.error('[PlanItemDetailsModal] Fallback copy also failed', { error: fallbackErr.message });
      }
      document.body.removeChild(textArea);
    }
  }, [getFullCopyableAddress]);

  if (!planItem) return null;

  const notes = planItem.details?.notes || [];
  const assignedTo = planItem.assignedTo;

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

  // Format scheduled date for display (short format without year)
  const getFormattedScheduledDate = () => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) return null;
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return d.toLocaleDateString(undefined, options);
  };

  // Format scheduled date for tooltip (full format with year)
  const getFullScheduledDate = () => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) return null;
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString(undefined, options);
  };

  // Format scheduled time for display (12-hour format)
  const getFormattedScheduledTime = () => {
    if (!scheduledTime) return null;
    // Handle HH:MM format
    if (/^\d{2}:\d{2}$/.test(scheduledTime)) {
      const [hours, minutes] = scheduledTime.split(':');
      const h = parseInt(hours, 10);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      return `${displayHour}:${minutes} ${period}`;
    }
    return scheduledTime;
  };

  // Check if we have any info to display in the info section
  const hasInfoToDisplay = scheduledDate || planningDays > 0 || costEstimate > 0 || actualCosts.length > 0;

  const getAssigneeName = () => {
    if (!assignedTo) return lang.current.planItemDetailsModal.unassigned;

    const assigneeId = assignedTo._id || assignedTo;
    const assignee = collaborators.find(c => {
      const collabId = c._id || c.user?._id;
      return collabId === assigneeId;
    });

    return assignee?.name || assignee?.user?.name || lang.current.planItemDetailsModal.unknownUser;
  };

  const handleAssignmentClick = () => {
    if (canEdit) {
      setIsEditingAssignment(true);
      setAssignmentSearch('');
    }
  };

  const handleSelectCollaborator = async (collaborator) => {
    const userId = collaborator._id || collaborator.user?._id;
    setIsEditingAssignment(false);
    setAssignmentSearch('');

    if (userId) {
      await onAssign(userId);
    }
  };

  const handleUnassign = async () => {
    setIsEditingAssignment(false);
    setAssignmentSearch('');
    await onUnassign();
  };

  const handleKeyDown = (e) => {
    if (!filteredCollaborators.length && highlightedIndex !== 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCollaborators.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === 0) {
          // Unassign option
          handleUnassign();
        } else if (highlightedIndex <= filteredCollaborators.length) {
          handleSelectCollaborator(filteredCollaborators[highlightedIndex - 1]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsEditingAssignment(false);
        setAssignmentSearch('');
        break;
      default:
        break;
    }
  };

  // Editable title component - shows input when editing, clickable text otherwise
  const editableTitle = canEdit && onUpdateTitle ? (
    isEditingTitle ? (
      <input
        ref={titleInputRef}
        type="text"
        className={styles.titleInput}
        value={titleText}
        onChange={(e) => setTitleText(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        aria-label={lang.current.aria.editPlanItemTitle}
      />
    ) : (
      <span
        className={styles.editableTitle}
        onClick={handleTitleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
        title={lang.current.tooltip.clickToEditTitle}
      >
        {planItem.text || 'Plan Item'}
      </span>
    )
  ) : (
    planItem.text || 'Plan Item'
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={editableTitle}
      size="fullscreen"
      bodyClassName={styles.modalBodyFullscreen}
    >
      <div className={styles.planItemDetailsModal}>
        {/* Assignment section */}
        <div className={styles.assignmentSection}>
          <label className={styles.assignmentLabel}>{lang.current.planItemDetailsModal.assignedTo}</label>
          {canEdit ? (
            <div className={styles.assignmentAutocompleteWrapper}>
              {!isEditingAssignment ? (
                <button
                  className={styles.assignmentLink}
                  onClick={handleAssignmentClick}
                  type="button"
                >
                  {getAssigneeName()}
                </button>
              ) : (
                <div className={styles.assignmentAutocomplete}>
                  <input
                    ref={assignmentInputRef}
                    type="text"
                    className={styles.assignmentInput}
                    placeholder={lang.current.planItemDetailsModal.searchCollaborators}
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {(isEditingAssignment && (filteredCollaborators.length > 0 || assignmentSearch)) && (
                    <div ref={dropdownRef} className={styles.assignmentDropdown}>
                      <div
                        className={`${styles.assignmentOption} ${highlightedIndex === 0 ? styles.highlighted : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnassign();
                        }}
                        onMouseEnter={() => setHighlightedIndex(0)}
                      >
                        <span className={styles.assignmentOptionText}>-- {lang.current.planItemDetailsModal.unassigned} --</span>
                      </div>
                      {filteredCollaborators.map((collab, index) => {
                        const userId = collab._id || collab.user?._id;
                        const userName = collab.name || collab.user?.name || lang.current.planItemDetailsModal.unknownUser;
                        return (
                          <div
                            key={userId}
                            className={`${styles.assignmentOption} ${highlightedIndex === index + 1 ? styles.highlighted : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCollaborator(collab);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index + 1)}
                          >
                            <span className={styles.assignmentOptionText}>{userName}</span>
                          </div>
                        );
                      })}
                      {filteredCollaborators.length === 0 && assignmentSearch && (
                        <div className={`${styles.assignmentOption} ${styles.disabled}`}>
                          <span className={styles.assignmentOptionText}>{lang.current.planItemDetailsModal.noCollaboratorsFound}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className={styles.assignmentValue}>{getAssigneeName()}</span>
          )}

          {/* Completion toggle - next to assignment */}
          {onToggleComplete && (
            <div className={styles.completionToggle}>
              <Button
                variant={planItem.complete ? 'success' : 'outline'}
                size="sm"
                onClick={() => onToggleComplete(planItem)}
                disabled={!canEdit}
                aria-pressed={!!planItem.complete}
                title={planItem.complete ? 'Mark as incomplete' : 'Mark as complete'}
                leftIcon={<span>{planItem.complete ? '✓' : '○'}</span>}
                className={styles.completeButton}
              >
                {planItem.complete ? lang.current.planItemDetailsModal.completed : lang.current.planItemDetailsModal.markComplete}
              </Button>
            </div>
          )}

          {/* Link to external URL if available */}
          {planItem.url && (() => {
            const safeUrl = sanitizeUrl(planItem.url);
            return safeUrl ? (
              <div className={styles.completionToggle}>
                <Button
                  as="a"
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                  title="Open external link"
                  leftIcon={<span>🔗</span>}
                >
                  View Link
                </Button>
              </div>
            ) : null;
          })()}
        </div>

        {/* Cost & Planning Info Section */}
        {hasInfoToDisplay && (
          <div className={styles.costPlanningSection}>
            {/* Scheduled Date/Time */}
            {scheduledDate && (
              <div
                className={`${styles.infoCard} ${styles.scheduledDateCard}`}
                onClick={() => setShowDateModal(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDateModal(true); }}
                title={lang.current.tooltip.clickToEditScheduledDate}
              >
                <span className={styles.infoIcon}>📅</span>
                <div className={styles.infoContent}>
                  <span className={styles.infoLabel}>Scheduled</span>
                  <span className={styles.scheduledDateValue}>
                    {getFormattedScheduledDate()}
                    {scheduledTime && <span className={styles.scheduledTime}> at {getFormattedScheduledTime()}</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Planning Days */}
            {planningDays > 0 && (
              <Tooltip content={getPlanningTimeTooltip()} placement="top">
                <div className={styles.infoCard}>
                  <span className={styles.infoIcon}>⏱️</span>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>{lang.en.label.planningTime}</span>
                    <span className={styles.infoValue}>
                      {formatPlanningTime(planningDays)}
                    </span>
                  </div>
                </div>
              </Tooltip>
            )}

            {/* Cost Estimate - forecasted by experience creator */}
            {costEstimate > 0 && (
              <Tooltip content={getCostEstimateTooltip(costEstimate, { currency })} placement="top">
                <div className={styles.infoCard}>
                  <span className={styles.infoIcon}>💰</span>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>{lang.en.heading.estimatedCost}</span>
                    <span className={styles.infoValue}>
                      {formatCostEstimate(costEstimate, { currency })}
                    </span>
                  </div>
                </div>
              </Tooltip>
            )}

            {/* Tracked Costs - shows total only (itemized on Details tab) */}
            {actualCosts.length > 0 && (
              <Tooltip content={getTrackedCostTooltip(totalActualCost, actualCosts.length, { currency })} placement="top">
                <div className={styles.infoCard}>
                  <span className={styles.infoIcon}>💵</span>
                  <div className={styles.infoContent}>
                    <span className={styles.infoLabel}>
                      {lang.en.heading.trackedCosts || 'Tracked Costs'}
                    </span>
                    <span className={styles.infoValue}>
                      {formatActualCost(totalActualCost, { currency, exact: true })}
                    </span>
                  </div>
                </div>
              </Tooltip>
            )}

            {/* Action buttons: Add and Share - stacked vertically */}
            {(canEdit && (onAddCostForItem || onAddDetail)) || onShare ? (
              <div className={styles.actionButtonsStack}>
                {/* + Add Button with Dropdown - add costs, transport details, etc. */}
                {canEdit && (onAddCostForItem || onAddDetail) && (
                  <div className={styles.addDropdownWrapper} ref={addDropdownRef}>
                    <Tooltip content="Add costs, reservations, or other details" placement="top">
                      <Button
                        variant="gradient"
                        size="sm"
                        onClick={handleToggleAddDropdown}
                        aria-expanded={showAddDropdown}
                        aria-haspopup="menu"
                        leftIcon={<FaPlus />}
                        rightIcon={<span className={styles.addButtonCaret}>▾</span>}
                      >
                        {lang.current.button.add}
                      </Button>
                    </Tooltip>

                    {showAddDropdown && (
                      <div className={styles.addDropdownMenu} role="menu">
                        {/* Filter input for searching detail types */}
                        <div className={styles.addDropdownFilterWrapper}>
                          <input
                            ref={addDropdownFilterRef}
                            type="text"
                            className={styles.addDropdownFilterInput}
                            placeholder={lang.current.placeholder.search}
                            value={addDropdownFilter}
                            onChange={(e) => setAddDropdownFilter(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={lang.current.aria.filterDetailTypes}
                          />
                        </div>
                        {/* Filtered list of detail types */}
                        <div className={styles.addDropdownItems}>
                          {filteredDetailTypes.length > 0 ? (
                            filteredDetailTypes.map((item) => (
                              <button
                                key={item.type}
                                type="button"
                                className={styles.addDropdownItem}
                                onClick={() => handleSelectDetailType(item.type)}
                                role="menuitem"
                              >
                                <span className={styles.addDropdownIcon}>{item.icon}</span>
                                <span className={styles.addDropdownLabel}>{item.label}</span>
                              </button>
                            ))
                          ) : (
                            <div className={styles.addDropdownNoResults}>
                              No matching types
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Share Button */}
                {onShare && (
                  <Tooltip content="Share this plan item" placement="top">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShare(planItem)}
                      leftIcon={<FaShareAlt />}
                      fullWidth
                    >
                      {lang.current.planItemDetailsModal.share}
                    </Button>
                  </Tooltip>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Tab options configuration */}
        {(() => {
          const tabOptions = [
            { key: 'details', label: lang.current.planItemDetailsModal.tabDetails, badge: totalDetailsCount > 0 ? `(${totalDetailsCount})` : null },
            { key: 'notes', label: lang.current.planItemDetailsModal.tabNotes, badge: notes.length > 0 ? `(${notes.length})` : null },
            { key: 'location', label: lang.current.planItemDetailsModal.tabLocation, badge: planItem?.location?.address ? '✓' : null },
            { key: 'chat', label: lang.current.planItemDetailsModal.tabChat, badge: null },
            { key: 'photos', label: lang.current.planItemDetailsModal.tabPhotos, badge: null },
            { key: 'documents', label: lang.current.planItemDetailsModal.tabDocuments, badge: null }
          ];
          const activeOption = tabOptions.find(opt => opt.key === activeTab) || tabOptions[0];

          return (
            <>
              {/* Desktop: Traditional tab buttons */}
              <div className={styles.detailsTabs}>
                {tabOptions.map(opt => (
                  <button
                    key={opt.key}
                    className={`${styles.detailsTab} ${activeTab === opt.key ? styles.active : ''}`}
                    onClick={() => setActiveTab(opt.key)}
                    type="button"
                  >
                    {opt.label} {opt.badge}
                  </button>
                ))}
              </div>

              {/* Mobile/Tablet: Dropdown selector */}
              <div className={styles.tabsDropdownWrapper}>
                <Dropdown onSelect={(key) => setActiveTab(key)} className={styles.tabsDropdown}>
                  <Dropdown.Toggle variant="outline-secondary" className={styles.tabsDropdownToggle}>
                    <span className={styles.tabsDropdownLabel}>
                      {activeOption.label} {activeOption.badge}
                    </span>
                    <FaChevronDown className={styles.tabsDropdownIcon} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu
                    className={styles.tabsDropdownMenu}
                    renderOnMount
                    popperConfig={{
                      strategy: 'fixed',
                      modifiers: [
                        {
                          name: 'preventOverflow',
                          options: {
                            boundary: 'viewport'
                          }
                        }
                      ]
                    }}
                  >
                    {tabOptions.map(opt => (
                      <Dropdown.Item
                        key={opt.key}
                        eventKey={opt.key}
                        active={activeTab === opt.key}
                        className={styles.tabsDropdownItem}
                      >
                        {opt.label} {opt.badge}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </>
          );
        })()}

        {/* Tab content - height calculated dynamically via JavaScript */}
        <div className={styles.detailsContent}>
          {activeTab === 'details' && (
            <div className={styles.detailsTabContent}>
              {/* Export PDF button */}
              {totalDetailsCount > 0 && (
                <div className={styles.detailsExportBar}>
                  <Tooltip content="Export all details to PDF" placement="left">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                      leftIcon={<FaFilePdf />}
                    >
                      {lang.current.planItemDetailsModal.exportPdf}
                    </Button>
                  </Tooltip>
                </div>
              )}

              {/* Grouped details list */}
              {totalDetailsCount > 0 ? (
                <div className={styles.detailsGroupedList}>
                  {Object.entries(groupedDetails).map(([categoryKey, category]) => (
                    <div key={categoryKey} className={styles.detailsCategory}>
                      <h3 className={styles.detailsCategoryTitle}>
                        <span className={styles.detailsCategoryIcon}>{category.icon}</span>
                        <span>{category.label}</span>
                        <span className={styles.detailsCategoryCount}>({category.items.length})</span>
                      </h3>
                      <div className={styles.detailsCategoryItems}>
                        {category.items.map((item, index) => (
                          <div key={item._id || index} className={styles.detailItem}>
                            <div className={styles.detailItemHeader}>
                              <span className={styles.detailItemIcon}>{item.typeConfig.icon}</span>
                              <span className={styles.detailItemType}>{item.typeConfig.label}</span>
                            </div>
                            <div className={styles.detailItemContent}>
                              <div className={styles.detailItemTitle}>
                                {item.title || item.name || item.confirmation_number || item.airline || item.hotel_name || 'Detail'}
                              </div>
                              <dl className={styles.detailItemMeta}>
                                {/* Render relevant fields based on detail type */}
                                {item.type === DETAIL_TYPES.COST && (
                                  <>
                                    {(item.cost !== undefined && item.cost !== null) && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Amount:</dt>
                                        <dd>{formatActualCost(item.cost, { currency: item.currency || 'USD', exact: true })}</dd>
                                      </div>
                                    )}
                                    {item.category && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Category:</dt>
                                        <dd>{item.category}</dd>
                                      </div>
                                    )}
                                    {/* Show who paid - collaborator name or Shared Cost */}
                                    <div className={styles.detailMetaRow}>
                                      <dt>{item.collaborator ? 'Paid for:' : 'Type:'}</dt>
                                      <dd>
                                        {item.collaborator ? (
                                          (() => {
                                            const collab = collaborators.find(c => {
                                              const id = c._id || c.user?._id;
                                              return id === item.collaborator || id?.toString() === item.collaborator?.toString();
                                            });
                                            return collab ? (collab.name || collab.user?.name) : 'Unknown';
                                          })()
                                        ) : (
                                          'Shared Cost'
                                        )}
                                      </dd>
                                    </div>
                                  </>
                                )}
                                {item.type === DETAIL_TYPES.FLIGHT && (
                                  <>
                                    {item.airline && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Airline:</dt>
                                        <dd>{item.airline}</dd>
                                      </div>
                                    )}
                                    {item.flight_number && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Flight:</dt>
                                        <dd>{item.flight_number}</dd>
                                      </div>
                                    )}
                                    {item.departure_date && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Departure:</dt>
                                        <dd>{item.departure_date} {item.departure_time || ''}</dd>
                                      </div>
                                    )}
                                    {item.confirmation_number && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Confirmation:</dt>
                                        <dd>{item.confirmation_number}</dd>
                                      </div>
                                    )}
                                  </>
                                )}
                                {item.type === DETAIL_TYPES.HOTEL && (
                                  <>
                                    {item.hotel_name && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Hotel:</dt>
                                        <dd>{item.hotel_name}</dd>
                                      </div>
                                    )}
                                    {item.check_in && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Check-in:</dt>
                                        <dd>{item.check_in}</dd>
                                      </div>
                                    )}
                                    {item.check_out && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Check-out:</dt>
                                        <dd>{item.check_out}</dd>
                                      </div>
                                    )}
                                    {item.confirmation_number && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Confirmation:</dt>
                                        <dd>{item.confirmation_number}</dd>
                                      </div>
                                    )}
                                  </>
                                )}
                                {(item.type === DETAIL_TYPES.TRAIN || item.type === DETAIL_TYPES.BUS || item.type === DETAIL_TYPES.FERRY || item.type === DETAIL_TYPES.CRUISE) && (
                                  <>
                                    {item.departure_station && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>From:</dt>
                                        <dd>{item.departure_station}</dd>
                                      </div>
                                    )}
                                    {item.arrival_station && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>To:</dt>
                                        <dd>{item.arrival_station}</dd>
                                      </div>
                                    )}
                                    {item.departure_date && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Date:</dt>
                                        <dd>{item.departure_date} {item.departure_time || ''}</dd>
                                      </div>
                                    )}
                                    {item.confirmation_number && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Confirmation:</dt>
                                        <dd>{item.confirmation_number}</dd>
                                      </div>
                                    )}
                                  </>
                                )}
                                {item.type === DETAIL_TYPES.PARKING && (
                                  <>
                                    {item.location && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Location:</dt>
                                        <dd>{item.location}</dd>
                                      </div>
                                    )}
                                    {item.start_date && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Start:</dt>
                                        <dd>{item.start_date}</dd>
                                      </div>
                                    )}
                                    {item.end_date && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>End:</dt>
                                        <dd>{item.end_date}</dd>
                                      </div>
                                    )}
                                    {item.confirmation_number && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Confirmation:</dt>
                                        <dd>{item.confirmation_number}</dd>
                                      </div>
                                    )}
                                  </>
                                )}
                                {item.type === DETAIL_TYPES.DISCOUNT && (
                                  <>
                                    {item.code && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Code:</dt>
                                        <dd className={styles.discountCode}>{item.code}</dd>
                                      </div>
                                    )}
                                    {item.discount_amount && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Discount:</dt>
                                        <dd>{item.discount_amount}{item.discount_type === 'percentage' ? '%' : ''}</dd>
                                      </div>
                                    )}
                                    {item.expiry_date && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Expires:</dt>
                                        <dd>{item.expiry_date}</dd>
                                      </div>
                                    )}
                                    {item.terms && (
                                      <div className={styles.detailMetaRow}>
                                        <dt>Terms:</dt>
                                        <dd>{item.terms}</dd>
                                      </div>
                                    )}
                                  </>
                                )}
                                {/* Notes field for any type */}
                                {item.notes && (
                                  <div className={styles.detailMetaRow}>
                                    <dt>Notes:</dt>
                                    <dd>{item.notes}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  variant="generic"
                  icon="📋"
                  title={lang.current.planItemDetailsModal.noDetailsAdded}
                  description={lang.current.planItemDetailsModal.noDetailsDescription}
                  size="md"
                  fillContainer
                />
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className={styles.notesTabWrapper}>
              <PlanItemNotes
                notes={notes}
                currentUser={currentUser}
                onAddNote={onAddNote}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
                disabled={!canEdit}
                availableEntities={availableEntities}
                entityData={entityData}
                onEntityClick={handleEntityClick}
                presenceConnected={presenceConnected}
                onlineUserIds={onlineUserIds}
                collaborators={collaborators}
              />
            </div>
          )}

          {activeTab === 'location' && (
            <div className={styles.locationTabContent}>
              {getLocationForMap() ? (
                <>
                  {/* Location details */}
                  <div className={styles.locationHeader}>
                    <div className={styles.locationIcon}>
                      <FaMapMarkerAlt />
                    </div>
                    <div className={styles.locationInfo}>
                      <div className={styles.locationAddress}>
                        {planItem.location.address}
                      </div>
                      {(planItem.location.city || planItem.location.state || planItem.location.country) && (
                        <div className={styles.locationMeta}>
                          {[planItem.location.city, planItem.location.state, planItem.location.country]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLocationModal(true)}
                      >
                        {lang.current.planItemDetailsModal.change}
                      </Button>
                    )}
                  </div>

                  {/* Copyable address bar */}
                  <Tooltip content={addressCopied ? "Copied!" : "Click to copy address for use in other apps"} placement="top">
                    <button
                      type="button"
                      className={`${styles.copyableAddressBar} ${addressCopied ? styles.copied : ''}`}
                      onClick={handleCopyAddress}
                      aria-label={lang.current.aria.copyAddressToClipboard}
                    >
                      <span className={styles.copyableAddressText}>
                        {getFullCopyableAddress()}
                      </span>
                      <span className={styles.copyAddressIcon}>
                        {addressCopied ? <FaCheck /> : <FaCopy />}
                      </span>
                    </button>
                  </Tooltip>

                  {/* Google Map with Get Directions button */}
                  <div className={styles.locationMapWrapper}>
                    <GoogleMap
                      location={getLocationForMap()}
                      height={400}
                      showDirections={true}
                      title={`Map of ${planItem.location.address}`}
                    />
                  </div>
                </>
              ) : (
                <EmptyState
                  variant="generic"
                  icon="📍"
                  title={lang.current.planItemDetailsModal.noLocationSet}
                  description={lang.current.planItemDetailsModal.noLocationDescription}
                  primaryAction={canEdit ? lang.current.planItemDetailsModal.addLocation : null}
                  onPrimaryAction={canEdit ? () => setShowLocationModal(true) : null}
                  size="md"
                  fillContainer
                />
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className={styles.chatTabWrapper}>
              {!streamApiKey && (
                <Alert
                  type="danger"
                  message="Chat is not configured (missing VITE_STREAM_CHAT_API_KEY)."
                />
              )}

              {mergedChatError && <Alert type="danger" message={mergedChatError} />}

              {mergedChatLoading && <Loading size="sm" variant="centered" message="Loading chat..." />}

              {!mergedChatLoading && chatClient && chatChannel && (
                <div className={styles.chatPane}>
                  <Chat
                    client={chatClient}
                    theme={uiTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}
                  >
                    <Channel channel={chatChannel}>
                      <Window>
                        {/* No ChannelHeader - chat is already in plan item context (modal title) */}
                        <MessageList />
                        <MessageInput focus />
                      </Window>
                      <Thread />
                    </Channel>
                  </Chat>
                </div>
              )}
            </div>
          )}

          {/* PhotosTab - keep mounted but hidden to preserve state during tab switches */}
          {/* Use CSS class instead of inline display to maintain flex height chain */}
          <div
            className={styles.photosTabWrapper}
            style={{ display: activeTab === 'photos' ? 'flex' : 'none' }}
          >
            <PhotosTab
              planItem={planItem}
              plan={plan}
              canEdit={canEdit}
              currentUser={currentUser}
            />
          </div>

          {/* DocumentsTab - keep mounted but hidden to preserve state during tab switches */}
          {/* Use CSS class instead of inline display to maintain flex height chain */}
          <div
            className={styles.documentsTabWrapper}
            style={{ display: activeTab === 'documents' ? 'flex' : 'none' }}
          >
            <DocumentsTab
              planItem={planItem}
              plan={plan}
              canEdit={canEdit}
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
    </Modal>
  );
}
