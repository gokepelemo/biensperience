/**
 * Invite Tracking View
 *
 * Displays invite codes created by the user and their usage statistics.
 * Shows who has redeemed invite codes and detailed analytics.
 *
 * Loading Pattern: Uses progressive loading to avoid code duplication.
 * Header content loads immediately, dynamic content loads after API call.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tabs, Tab, Badge, Row, Col } from 'react-bootstrap';
import { FaQrcode, FaCheckCircle, FaTimesCircle, FaClock, FaUsers, FaChartLine, FaEnvelope, FaMapMarkerAlt, FaCalendar, FaUserPlus, FaCopy, FaSearch, FaFilter, FaTimes, FaBan, FaFileDownload, FaExclamationTriangle } from 'react-icons/fa';
import { lang } from '../../lang.constants';
import { getMyInvites, getInviteDetails, getInviteAnalytics } from '../../utilities/invite-tracking-service';
import { deactivateInvite } from '../../utilities/invites-api';
import { eventBus } from '../../utilities/event-bus';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { logger } from '../../utilities/logger';
import { getDefaultPhoto } from '../../utilities/photo-utils';
import { getFirstName } from '../../utilities/name-utils';
import { createFilter } from '../../utilities/trie';
import { exportToCsv, formatDateForCsv } from '../../utilities/csv-utils';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import Modal from '../../components/Modal/Modal';
import Pagination from '../../components/Pagination/Pagination';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import UserInviteModal from '../../components/UserInviteModal/UserInviteModal';
import { Button, Container, FlexBetween, Table, TableHead, TableBody, TableRow, TableCell, SpaceY, Pill, EmptyState } from '../../components/design-system';
import styles from './InviteTracking.module.scss';

// Status filter options
const STATUS_FILTERS = {
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  EXPIRING_SOON: 'expiringSoon',
  FULLY_USED: 'fullyUsed',
  IN_USE: 'inUse',
  AVAILABLE: 'available'
};

// Number of days before expiration to show "Expiring Soon" status
const EXPIRING_SOON_DAYS = 7;

export default function InviteTracking() {
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [inviteToDeactivate, setInviteToDeactivate] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const { success, error: showError } = useToast();
  const { user } = useUser();

  // Get the first name suffix for personalized messages (e.g., ", John")
  const firstNameSuffix = user?.name ? `, ${getFirstName(user.name)}` : '';

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Build trie filter for fast search on code and email fields
  const inviteTrieFilter = useMemo(() => {
    if (!invites || invites.length === 0) return null;
    return createFilter({
      fields: [
        { path: 'code', score: 100 },  // Higher score for code matches
        { path: 'email', score: 75 }
      ]
    }).buildIndex(invites);
  }, [invites]);

  // Get computed status for an invite (for filtering)
  const getInviteStatus = useCallback((invite) => {
    const now = new Date();
    const isExpired = invite.expiresAt && new Date(invite.expiresAt) < now;
    const isFullyUsed = invite.maxUses && invite.usedCount >= invite.maxUses;

    // Check if expiring within EXPIRING_SOON_DAYS
    let isExpiringSoon = false;
    if (invite.expiresAt && !isExpired) {
      const expiresAt = new Date(invite.expiresAt);
      const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
      isExpiringSoon = daysUntilExpiry <= EXPIRING_SOON_DAYS;
    }

    if (!invite.isActive) return STATUS_FILTERS.INACTIVE;
    if (isExpired) return STATUS_FILTERS.EXPIRED;
    if (isFullyUsed) return STATUS_FILTERS.FULLY_USED;
    if (isExpiringSoon) return STATUS_FILTERS.EXPIRING_SOON;
    if (invite.usedCount > 0) return STATUS_FILTERS.IN_USE;
    return STATUS_FILTERS.AVAILABLE;
  }, []);

  // Filter invites by search query and status filter
  const filteredInvites = useMemo(() => {
    let result = invites;

    // Apply status filter first
    if (statusFilter !== STATUS_FILTERS.ALL) {
      if (statusFilter === STATUS_FILTERS.ACTIVE) {
        // Active = isActive is true AND not expired AND not fully used
        result = result.filter(invite => {
          const status = getInviteStatus(invite);
          return status === STATUS_FILTERS.IN_USE || status === STATUS_FILTERS.AVAILABLE;
        });
      } else {
        result = result.filter(invite => getInviteStatus(invite) === statusFilter);
      }
    }

    // Apply search query using Trie
    if (searchQuery.trim()) {
      if (inviteTrieFilter) {
        // Use trie for fast search
        const searchResults = inviteTrieFilter.filter(searchQuery, { rankResults: true });
        // Filter to only include results that also match status filter
        const resultIds = new Set(result.map(i => i._id));
        result = searchResults.filter(invite => resultIds.has(invite._id));
      } else {
        // Fallback linear search
        const query = searchQuery.toLowerCase();
        result = result.filter(invite =>
          invite.code?.toLowerCase().includes(query) ||
          invite.email?.toLowerCase().includes(query)
        );
      }
    }

    return result;
  }, [invites, searchQuery, statusFilter, inviteTrieFilter, getInviteStatus]);

  // Compute paginated invites from filtered results
  const paginatedInvites = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvites.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInvites, currentPage]);

  // Calculate total pages from filtered results
  const totalPages = useMemo(() => {
    return Math.ceil(filteredInvites.length / ITEMS_PER_PAGE);
  }, [filteredInvites.length]);

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Clear search and filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter(STATUS_FILTERS.ALL);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() || statusFilter !== STATUS_FILTERS.ALL;

  // Event handlers for real-time invite updates
  const handleInviteCreated = useCallback((event) => {
    const invite = event.invite || event.detail?.invite;
    if (invite) {
      setInvites(prev => {
        // Avoid duplicates
        if (prev.some(i => i._id === invite._id || i.code === invite.code)) {
          return prev;
        }
        return [invite, ...prev];
      });
      // Update stats - use same field names as API response
      setStats(prev => prev ? {
        ...prev,
        totalInvites: (prev.totalInvites || 0) + 1,
        activeInvites: (prev.activeInvites || 0) + 1
      } : prev);
      logger.debug('[InviteTracking] Invite created event received', { inviteId: invite._id });
    }
  }, []);

  const handleInviteRedeemed = useCallback((event) => {
    const invite = event.invite || event.detail?.invite;
    const inviteId = invite?._id || event.inviteId || event.detail?.inviteId;
    if (inviteId) {
      setInvites(prev => prev.map(i => {
        if (i._id === inviteId || i.code === invite?.code) {
          return invite || { ...i, usedCount: (i.usedCount || 0) + 1 };
        }
        return i;
      }));
      // Update stats - use same field names as API response
      setStats(prev => prev ? {
        ...prev,
        totalRedemptions: (prev.totalRedemptions || 0) + 1
      } : prev);
      logger.debug('[InviteTracking] Invite redeemed event received', { inviteId });
    }
  }, []);

  const handleInviteDeleted = useCallback((event) => {
    const inviteId = event.inviteId || event.detail?.inviteId;
    if (inviteId) {
      setInvites(prev => {
        const deleted = prev.find(i => i._id === inviteId);
        if (deleted) {
          // Update stats - use same field names as API response
          setStats(s => s ? {
            ...s,
            totalInvites: Math.max(0, (s.totalInvites || 0) - 1),
            activeInvites: deleted.isActive ? Math.max(0, (s.activeInvites || 0) - 1) : s.activeInvites,
            totalRedemptions: Math.max(0, (s.totalRedemptions || 0) - deleted.usedCount)
          } : s);
        }
        return prev.filter(i => i._id !== inviteId);
      });
      logger.debug('[InviteTracking] Invite deleted event received', { inviteId });
    }
  }, []);

  // Subscribe to invite events for real-time updates
  useEffect(() => {
    const unsubCreate = eventBus.subscribe('invite:created', handleInviteCreated);
    const unsubRedeem = eventBus.subscribe('invite:redeemed', handleInviteRedeemed);
    const unsubDelete = eventBus.subscribe('invite:deleted', handleInviteDeleted);

    return () => {
      unsubCreate();
      unsubRedeem();
      unsubDelete();
    };
  }, [handleInviteCreated, handleInviteRedeemed, handleInviteDeleted]);

  // Load initial data (invites and analytics) in parallel
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch invites and analytics in parallel
      const [invitesResponse, analyticsData] = await Promise.all([
        getMyInvites(),
        getInviteAnalytics().catch(err => {
          // Don't fail the whole load for analytics - it's secondary data
          logger.error('Failed to load analytics', {}, err);
          return null;
        })
      ]);

      // Set invites and stats
      setInvites(invitesResponse.invites);
      setStats(invitesResponse.stats);
      logger.info('Invites loaded successfully', {
        count: invitesResponse.invites.length
      });

      // Set analytics if available
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (err) {
      logger.error('Failed to load invites', {}, err);
      setError(lang.current.alert.failedToLoadInviteCodes);
      showError(lang.current.alert.failedToLoadInviteCodes);
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadInviteDetails = async (code) => {
    setIsLoadingDetails(true);
    setActiveTab('details');
    try {
      const details = await getInviteDetails(code);
      setSelectedInvite(details);
    } catch (err) {
      logger.error('Failed to load invite details', { code }, err);
      showError(lang.current.alert.failedToLoadInviteDetails);
      // Go back to overview on error
      setActiveTab('overview');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getStatusBadge = (invite) => {
    const now = new Date();
    const isExpired = invite.expiresAt && new Date(invite.expiresAt) < now;
    const isFullyUsed = invite.maxUses && invite.usedCount >= invite.maxUses;

    // Check if expiring within EXPIRING_SOON_DAYS
    let isExpiringSoon = false;
    if (invite.expiresAt && !isExpired) {
      const expiresAt = new Date(invite.expiresAt);
      const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
      isExpiringSoon = daysUntilExpiry <= EXPIRING_SOON_DAYS;
    }

    if (!invite.isActive) {
      return <Pill variant="secondary"><FaTimesCircle /> {lang.current.inviteTracking.inactive}</Pill>;
    }
    if (isExpired) {
      return <Pill variant="danger"><FaClock /> {lang.current.inviteTracking.expired}</Pill>;
    }
    if (isFullyUsed) {
      return <Pill variant="warning"><FaCheckCircle /> {lang.current.inviteTracking.fullyUsed}</Pill>;
    }
    if (isExpiringSoon) {
      return <Pill variant="warning"><FaExclamationTriangle /> {lang.current.inviteTracking?.expiringSoon || 'Expiring Soon'}</Pill>;
    }
    if (invite.usedCount > 0) {
      return <Pill variant="info"><FaUsers /> {lang.current.inviteTracking.inUse}</Pill>;
    }
    return <Pill variant="success"><FaCheckCircle /> {lang.current.inviteTracking.available}</Pill>;
  };

  const formatDate = (date) => {
    if (!date) return lang.current.inviteTracking.never;
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Copy invite link to clipboard
  const copyInviteLink = useCallback(async (code) => {
    const signupUrl = `${window.location.origin}/signup?code=${code}`;
    try {
      await navigator.clipboard.writeText(signupUrl);
      success(lang.current.inviteTracking?.linkCopied || 'Invite link copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = signupUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      success(lang.current.inviteTracking?.linkCopied || 'Invite link copied to clipboard!');
    }
  }, [success]);

  // Open deactivate confirmation modal
  const handleDeactivateClick = useCallback((invite) => {
    setInviteToDeactivate(invite);
    setShowDeactivateModal(true);
  }, []);

  // Close deactivate confirmation modal
  const handleDeactivateCancel = useCallback(() => {
    setShowDeactivateModal(false);
    setInviteToDeactivate(null);
  }, []);

  // Confirm and execute deactivation
  const handleDeactivateConfirm = useCallback(async () => {
    if (!inviteToDeactivate) return;

    setIsDeactivating(true);
    try {
      await deactivateInvite(inviteToDeactivate._id);
      success(lang.current.inviteTracking?.inviteDeactivated || 'Invite code deactivated successfully');
      // The event bus will handle removing from state via handleInviteDeleted
      handleDeactivateCancel();
    } catch (err) {
      logger.error('Failed to deactivate invite', { inviteId: inviteToDeactivate._id }, err);
      showError(lang.current.inviteTracking?.failedToDeactivate || 'Failed to deactivate invite code');
    } finally {
      setIsDeactivating(false);
    }
  }, [inviteToDeactivate, success, showError, handleDeactivateCancel]);

  // Export invites to CSV
  const handleExportCsv = useCallback(() => {
    if (filteredInvites.length === 0) {
      showError(lang.current.inviteTracking?.noInvitesToExport || 'No invites to export');
      return;
    }

    const getStatusLabel = (invite) => {
      const now = new Date();
      const isExpired = invite.expiresAt && new Date(invite.expiresAt) < now;
      const isFullyUsed = invite.maxUses && invite.usedCount >= invite.maxUses;

      // Check if expiring within EXPIRING_SOON_DAYS
      let isExpiringSoon = false;
      if (invite.expiresAt && !isExpired) {
        const expiresAt = new Date(invite.expiresAt);
        const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
        isExpiringSoon = daysUntilExpiry <= EXPIRING_SOON_DAYS;
      }

      if (!invite.isActive) return lang.current.inviteTracking.inactive;
      if (isExpired) return lang.current.inviteTracking.expired;
      if (isFullyUsed) return lang.current.inviteTracking.fullyUsed;
      if (isExpiringSoon) return lang.current.inviteTracking?.expiringSoon || 'Expiring Soon';
      if (invite.usedCount > 0) return lang.current.inviteTracking.inUse;
      return lang.current.inviteTracking.available;
    };

    try {
      exportToCsv(filteredInvites, 'invites', {
        columns: ['code', 'email', 'status', 'usedCount', 'maxUses', 'createdAt', 'expiresAt'],
        headers: {
          code: lang.current.tableHeaders.code,
          email: lang.current.tableHeaders.email,
          status: lang.current.tableHeaders.status,
          usedCount: lang.current.inviteTracking?.usedHeader || 'Used',
          maxUses: lang.current.inviteTracking?.maxUsesHeader || 'Max Uses',
          createdAt: lang.current.tableHeaders.created,
          expiresAt: lang.current.tableHeaders.expires
        },
        formatters: {
          email: (value) => value || (lang.current.inviteTracking.any),
          status: (_, invite) => getStatusLabel(invite),
          maxUses: (value) => value || '∞',
          createdAt: (value) => formatDateForCsv(value),
          expiresAt: (value) => value ? formatDateForCsv(value) : (lang.current.inviteTracking.never)
        }
      });
      success(lang.current.inviteTracking?.csvExported || 'Invites exported to CSV');
    } catch (err) {
      logger.error('Failed to export invites to CSV', {}, err);
      showError(lang.current.inviteTracking?.exportFailed || 'Failed to export invites');
    }
  }, [filteredInvites, success, showError]);

  const renderOverview = () => (
    <div>
      {/* Statistics Cards */}
      {stats && (
        <div className={`${styles.statsGrid} mb-4`}>
          <Card className={styles.statCard}>
            <Card.Body>
              <div className="stat-icon">
                <FaQrcode />
              </div>
              <h2 className={styles.statValue}>{stats.totalInvites}</h2>
              <p style={{ color: 'var(--bs-gray-600)' }}>{lang.current.inviteTracking.totalInvites}</p>
            </Card.Body>
          </Card>
          <Card className={styles.statCard}>
            <Card.Body>
              <div className="stat-icon text-success">
                <FaCheckCircle />
              </div>
              <h2 className={styles.statValue}>{stats.activeInvites}</h2>
              <p className="text-muted">{lang.current.inviteTracking.active}</p>
            </Card.Body>
          </Card>
          <Card className={styles.statCard}>
            <Card.Body>
              <div className="stat-icon text-info">
                <FaUsers />
              </div>
              <h2 className={styles.statValue}>{stats.totalRedemptions}</h2>
              <p style={{ color: 'var(--bs-gray-600)' }}>{lang.current.inviteTracking.redemptions}</p>
            </Card.Body>
          </Card>
          <Card className={styles.statCard}>
            <Card.Body>
              <div className="stat-icon text-danger">
                <FaClock />
              </div>
              <h2 className={styles.statValue}>{stats.expiredInvites}</h2>
              <p style={{ color: 'var(--bs-gray-600)' }}>{lang.current.inviteTracking.expired}</p>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Invites Table */}
      <Card>
        {/* Search and Filter Bar */}
        {invites.length > 0 && (
          <div className={styles.searchFilterBar}>
            <div className={styles.searchInputWrapper}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={lang.current.inviteTracking?.searchPlaceholder || 'Search by code or email...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search invites"
              />
              {searchQuery && (
                <button
                  className={styles.clearSearchButton}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            <div className={styles.filterWrapper}>
              <FaFilter className={styles.filterIcon} />
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value={STATUS_FILTERS.ALL}>{lang.current.inviteTracking?.filterAll || 'All Statuses'}</option>
                <option value={STATUS_FILTERS.ACTIVE}>{lang.current.inviteTracking?.filterActive || 'Active'}</option>
                <option value={STATUS_FILTERS.AVAILABLE}>{lang.current.inviteTracking?.filterAvailable || 'Available'}</option>
                <option value={STATUS_FILTERS.IN_USE}>{lang.current.inviteTracking?.filterInUse || 'In Use'}</option>
                <option value={STATUS_FILTERS.EXPIRED}>{lang.current.inviteTracking?.filterExpired || 'Expired'}</option>
                <option value={STATUS_FILTERS.EXPIRING_SOON}>{lang.current.inviteTracking?.filterExpiringSoon || 'Expiring Soon'}</option>
                <option value={STATUS_FILTERS.FULLY_USED}>{lang.current.inviteTracking?.filterFullyUsed || 'Fully Used'}</option>
                <option value={STATUS_FILTERS.INACTIVE}>{lang.current.inviteTracking?.filterInactive || 'Inactive'}</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                className={styles.clearFiltersButton}
                onClick={handleClearFilters}
                aria-label="Clear all filters"
              >
                <FaTimes className="me-1" />
                {lang.current.inviteTracking?.clearFilters || 'Clear'}
              </button>
            )}

            <button
              className={styles.exportButton}
              onClick={handleExportCsv}
              disabled={filteredInvites.length === 0}
              title={lang.current.inviteTracking?.exportCsv || 'Export CSV'}
              aria-label="Export invites to CSV"
            >
              <FaFileDownload className="me-1" />
              {lang.current.inviteTracking?.exportCsv || 'Export CSV'}
            </button>
          </div>
        )}

        {/* Filter results info */}
        {hasActiveFilters && invites.length > 0 && (
          <div className={styles.filterResultsInfo}>
            {lang.current.inviteTracking?.showingResults
              ? lang.current.inviteTracking.showingResults
                  .replace('{count}', filteredInvites.length)
                  .replace('{total}', invites.length)
              : `Showing ${filteredInvites.length} of ${invites.length} invites`}
          </div>
        )}

        <Card.Body className="p-0">
          {invites.length === 0 ? (
            <EmptyState
              variant="invites"
              title={lang.current.message.noInviteCodes.replace('{first_name_suffix}', firstNameSuffix)}
              description={lang.current.inviteTracking.noInviteCodesDescription}
              primaryAction={lang.current.inviteTracking?.createFirstInvite || 'Create Your First Invite'}
              onPrimaryAction={() => setShowInviteModal(true)}
              size="md"
              compact
            />
          ) : filteredInvites.length === 0 ? (
            <EmptyState
              variant="search"
              icon="🔍"
              title={lang.current.inviteTracking?.noMatchingInvites || 'No matching invites'}
              description={lang.current.inviteTracking?.tryDifferentSearch || 'Try adjusting your search or filter criteria'}
              primaryAction={lang.current.inviteTracking?.clearFilters || 'Clear Filters'}
              onPrimaryAction={handleClearFilters}
              size="sm"
              compact
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className={styles.desktopTable}>
                <Table hover striped responsive>
                  <TableHead>
                    <TableRow>
                      <TableCell header>{lang.current.tableHeaders.code}</TableCell>
                      <TableCell header>{lang.current.tableHeaders.status}</TableCell>
                      <TableCell header>{lang.current.tableHeaders.email}</TableCell>
                      <TableCell header>{lang.current.tableHeaders.used}</TableCell>
                      <TableCell header>{lang.current.tableHeaders.created}</TableCell>
                      <TableCell header>{lang.current.tableHeaders.expires}</TableCell>
                      <TableCell header className="text-end">{lang.current.tableHeaders.actions}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedInvites.map((invite) => (
                      <TableRow key={invite._id}>
                        <TableCell>
                          <div className={styles.inviteCodeCell}>
                            <code className={styles.inviteCode}>{invite.code}</code>
                            <button
                              className={styles.copyButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyInviteLink(invite.code);
                              }}
                              title={lang.current.inviteTracking?.copyLink || 'Copy invite link'}
                              aria-label={`Copy invite link for ${invite.code}`}
                            >
                              <FaCopy />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(invite)}</TableCell>
                        <TableCell>
                          {invite.email ? (
                            <span>
                              <FaEnvelope className="me-1" />
                              {invite.email}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--bs-gray-600)' }}>{lang.current.inviteTracking.any}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="badge badge-secondary">
                            {invite.usedCount}/{invite.maxUses || '∞'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(invite.createdAt)}</TableCell>
                        <TableCell>
                          {invite.expiresAt ? (
                            formatDate(invite.expiresAt)
                          ) : (
                            <span style={{ color: 'var(--bs-gray-600)' }}>{lang.current.inviteTracking.never}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className={styles.actionButtons}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => loadInviteDetails(invite.code)}
                            >
                              {lang.current.button.viewDetails}
                            </Button>
                            {invite.isActive && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeactivateClick(invite)}
                                title={lang.current.inviteTracking?.deactivate || 'Deactivate'}
                                aria-label={`Deactivate invite ${invite.code}`}
                              >
                                <FaBan />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className={styles.mobileCards}>
                {paginatedInvites.map((invite) => (
                  <div key={invite._id} className={styles.inviteCard}>
                    <div className={styles.inviteCardHeader}>
                      <div className={styles.inviteCodeCell}>
                        <code className={styles.inviteCode}>{invite.code}</code>
                        <button
                          className={styles.copyButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyInviteLink(invite.code);
                          }}
                          title={lang.current.inviteTracking?.copyLink || 'Copy invite link'}
                          aria-label={`Copy invite link for ${invite.code}`}
                        >
                          <FaCopy />
                        </button>
                      </div>
                      {getStatusBadge(invite)}
                    </div>

                    <div className={styles.inviteCardBody}>
                      <div className={styles.inviteCardRow}>
                        <span className={styles.inviteCardLabel}>{lang.current.tableHeaders.email}</span>
                        <span className={styles.inviteCardValue}>
                          {invite.email ? (
                            <>
                              <FaEnvelope className="me-1" />
                              {invite.email}
                            </>
                          ) : (
                            <span className={styles.inviteCardMuted}>{lang.current.inviteTracking.any}</span>
                          )}
                        </span>
                      </div>

                      <div className={styles.inviteCardRow}>
                        <span className={styles.inviteCardLabel}>{lang.current.tableHeaders.used}</span>
                        <span className={styles.inviteCardValue}>
                          <Badge className="badge badge-secondary">
                            {invite.usedCount}/{invite.maxUses || '∞'}
                          </Badge>
                        </span>
                      </div>

                      <div className={styles.inviteCardRow}>
                        <span className={styles.inviteCardLabel}>{lang.current.tableHeaders.created}</span>
                        <span className={styles.inviteCardValue}>{formatDate(invite.createdAt)}</span>
                      </div>

                      <div className={styles.inviteCardRow}>
                        <span className={styles.inviteCardLabel}>{lang.current.tableHeaders.expires}</span>
                        <span className={styles.inviteCardValue}>
                          {invite.expiresAt ? (
                            formatDate(invite.expiresAt)
                          ) : (
                            <span className={styles.inviteCardMuted}>{lang.current.inviteTracking.never}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className={styles.inviteCardActions}>
                      <button
                        className="btn btn-sm btn-outline-primary flex-grow-1"
                        onClick={() => loadInviteDetails(invite.code)}
                      >
                        {lang.current.button.viewDetails}
                      </button>
                      {invite.isActive && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeactivateClick(invite)}
                          title={lang.current.inviteTracking?.deactivate || 'Deactivate'}
                          aria-label={`Deactivate invite ${invite.code}`}
                        >
                          <FaBan />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4 mb-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalResults={filteredInvites.length}
                resultsPerPage={ITEMS_PER_PAGE}
                variant="numbers"
              />
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );

  const renderDetails = () => {
    if (isLoadingDetails) {
      return <Loading size="lg" message={lang.current.alert?.loadingInviteDetails || 'Loading invite details...'} />;
    }

    if (!selectedInvite) {
      return <Alert type="info" message={lang.current.message.selectInviteCode} />;
    }

    return (
      <div>
        <button
          className="btn btn-outline-secondary mb-3"
          onClick={() => setActiveTab('overview')}
        >
          {lang.current.button.backToOverview}
        </button>

        <div className={styles.inviteDetailsGrid}>
          <div className={styles.inviteDetailsSidebar}>
            <Card className="mb-3">
              <Card.Header>
                <h6><FaQrcode /> {lang.current.inviteTracking.inviteCodeDetails}</h6>
              </Card.Header>
              <Card.Body>
                <div className={styles.inviteDetailItem}>
                  <strong>{lang.current.inviteTracking.code}:</strong>
                  <code className={styles.inviteCodeLarge}>{selectedInvite.code}</code>
                </div>
                <div className={styles.inviteDetailItem}>
                  <strong>{lang.current.inviteTracking.status}:</strong>
                  {getStatusBadge(selectedInvite)}
                </div>
                <div className={styles.inviteDetailItem}>
                  <strong>{lang.current.inviteTracking.usage}:</strong>
                  <div>
                    <Pill variant="secondary">
                      {selectedInvite.usedCount}/{selectedInvite.maxUses || '∞'}
                    </Pill>
                    {selectedInvite.usagePercentage && (
                      <span className="ms-2" style={{ color: 'var(--bs-gray-600)' }}>
                        ({selectedInvite.usagePercentage}%)
                      </span>
                    )}
                  </div>
                </div>
                {selectedInvite.email && (
                  <div className={styles.inviteDetailItem}>
                    <strong>{lang.current.inviteTracking.restrictedTo}:</strong>
                    <div>
                      <FaEnvelope className="me-1" />
                      {selectedInvite.email}
                    </div>
                  </div>
                )}
                <div className={styles.inviteDetailItem}>
                  <strong>{lang.current.inviteTracking.created}:</strong>
                  <div>
                    <FaCalendar className="me-1" />
                    {formatDate(selectedInvite.createdAt)}
                  </div>
                </div>
                {selectedInvite.expiresAt && (
                  <div className={styles.inviteDetailItem}>
                    <strong>{lang.current.inviteTracking.expires}:</strong>
                    <div>
                      <FaClock className="me-1" />
                      {formatDate(selectedInvite.expiresAt)}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Pre-configured Resources */}
            {(selectedInvite.experiences?.length > 0 || selectedInvite.destinations?.length > 0) && (
              <Card>
                <Card.Header>
                  <h6><FaMapMarkerAlt /> {lang.current.inviteTracking.preConfiguredResources}</h6>
                </Card.Header>
                <Card.Body>
                  {selectedInvite.experiences?.length > 0 && (
                    <div className="mb-3">
                      <strong>{lang.current.inviteTracking.experiencesCount.replace('{count}', selectedInvite.experiences.length)}:</strong>
                      <ul className={styles.resourceList}>
                        {selectedInvite.experiences.map((exp) => (
                          <li key={exp._id}>
                            <Link to={`/experiences/${exp._id}`}>{exp.name}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedInvite.destinations?.length > 0 && (
                    <div>
                      <strong>{lang.current.inviteTracking.destinationsCount.replace('{count}', selectedInvite.destinations.length)}:</strong>
                      <ul className={styles.resourceList}>
                        {selectedInvite.destinations.map((dest) => (
                          <li key={dest._id}>
                            <Link to={`/destinations/${dest._id}`}>
                              {dest.name}, {dest.country}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>

          <div className={styles.inviteDetailsMain}>
            <Card>
              <Card.Header>
                <h6><FaUsers /> {lang.current.inviteTracking.redeemedBy.replace('{count}', selectedInvite.redeemedBy?.length || 0)}</h6>
              </Card.Header>
              <Card.Body className="p-0">
                {!selectedInvite.redeemedBy || selectedInvite.redeemedBy.length === 0 ? (
                  <EmptyState
                    variant="users"
                    icon="👥"
                    title={lang.current.inviteTracking.noRedemptionsYet}
                    description={lang.current.inviteTracking.shareToGetStarted}
                    size="sm"
                    compact
                  />
                ) : (
                  <Table hover striped responsive>
                    <TableHead>
                      <TableRow>
                        <th>{lang.current.tableHeaders.user}</th>
                        <th>{lang.current.tableHeaders.email}</th>
                        <th>{lang.current.tableHeaders.joined}</th>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvite.redeemedBy.map((user) => {
                        const defaultPhoto = getDefaultPhoto(user);
                        const photoUrl = defaultPhoto?.url || user.oauthProfilePhoto;

                        return (
                          <TableRow key={user._id}>
                            <TableCell>
                              <div className="d-flex align-items-center">
                                {photoUrl && (
                                  <img
                                    src={photoUrl}
                                    alt={user.name}
                                    className={`${styles.userAvatarSmall} me-2`}
                                  />
                                )}
                                <span>{user.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{formatDate(user.createdAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!analytics) {
      return <Loading size="lg" message={lang.current.alert.loadingAnalytics} />;
    }

    return (
      <div>
        <Row className="mb-4">
          <Col md={12}>
            <h2><FaChartLine /> {lang.current.inviteTracking.inviteAnalytics}</h2>
          </Col>
        </Row>

        <div className={`${styles.analyticsGrid} mb-4`}>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.totalInvitesCreated}</h6>
              <div className={styles.analyticsValue}>{analytics.totalInvites}</div>
            </Card.Body>
          </Card>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.totalRedemptions}</h6>
              <div className={styles.analyticsValue}>{analytics.totalRedemptions}</div>
            </Card.Body>
          </Card>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.redemptionRate}</h6>
              <div className={styles.analyticsValue}>{analytics.redemptionRate}%</div>
            </Card.Body>
          </Card>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.avgRedemptionsPerInvite}</h6>
              <div className={styles.analyticsValue}>{analytics.averageRedemptionsPerInvite}</div>
            </Card.Body>
          </Card>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.activeInvites}</h6>
              <div className={styles.analyticsValue}>{analytics.activeInvites}</div>
            </Card.Body>
          </Card>
          <Card className={styles.analyticsCard}>
            <Card.Body>
              <h6>{lang.current.inviteTracking.unusedInvites}</h6>
              <div className={styles.analyticsValue}>{analytics.unusedInvites}</div>
            </Card.Body>
          </Card>
        </div>
        <div className={`${styles.activityGrid} mt-4`}>
          <Card>
            <Card.Header>
              <h6>{lang.current.inviteTracking.recentActivity}</h6>
            </Card.Header>
            <Card.Body>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.last7Days}:</strong>
                <span className="float-end">
                  <Pill variant="info">{analytics.redemptionsLast7Days} {lang.current.inviteTracking.redemptionsSuffix}</Pill>
                  <Pill variant="secondary" className="ms-2">
                    {analytics.invitesCreatedLast7Days} {lang.current.inviteTracking.createdSuffix}
                  </Pill>
                </span>
              </div>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.last30Days}:</strong>
                <span className="float-end">
                  <Pill variant="info">{analytics.redemptionsLast30Days} {lang.current.inviteTracking.redemptionsSuffix}</Pill>
                  <Pill variant="secondary" className="ms-2">
                    {analytics.invitesCreatedLast30Days} {lang.current.inviteTracking.createdSuffix}
                  </Pill>
                </span>
              </div>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>
              <h6>{lang.current.inviteTracking.inviteStatusBreakdown}</h6>
            </Card.Header>
            <Card.Body>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.expired}:</strong>
                <Pill variant="danger" className="float-end">{analytics.expiredInvites}</Pill>
              </div>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.fullyUsed}:</strong>
                <Pill variant="warning" className="float-end">{analytics.fullyUsedInvites}</Pill>
              </div>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.emailRestricted}:</strong>
                <Pill variant="secondary" className="float-end">
                  {analytics.emailRestrictedInvites}
                </Pill>
              </div>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>
              <h6>{lang.current.inviteTracking.preConfiguredResources}</h6>
            </Card.Header>
            <Card.Body>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.withExperiences}:</strong>
                <Pill variant="info" className="float-end">
                  {analytics.invitesWithExperiences}
                </Pill>
              </div>
              <div className={styles.analyticsItem}>
                <strong>{lang.current.inviteTracking.withDestinations}:</strong>
                <Pill variant="success" className="float-end">
                  {analytics.invitesWithDestinations}
                </Pill>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageOpenGraph
        title={lang.current.inviteTracking.pageTitle}
        description={lang.current.inviteTracking.pageDescription}
        keywords={lang.current.inviteTracking.pageKeywords}
        ogTitle={lang.current.inviteTracking.ogTitle}
        ogDescription={lang.current.inviteTracking.ogDescription}
      />
      <div className="profile-dropdown-view">
        <div className="container-fluid">
          <div className="view-header">
            <div className="row">
              <div className="col-12">
                <FlexBetween className="mb-2">
                  <h1 className="mb-0"><FaQrcode /> {lang.current.inviteTracking.heading}</h1>
                  <Button
                    variant="primary"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <FaUserPlus className="me-2" />
                    {lang.current.invite?.heading || 'Invite Users'}
                  </Button>
                </FlexBetween>
                <p className="header-description">
                  {lang.current.inviteTracking.headerDescription}
                </p>
              </div>
            </div>
          </div>        {error && (
          <Alert type="danger" message={error} dismissible onClose={() => setError(null)} />
        )}

        {isLoading ? (
          <Loading size="lg" message={lang.current.alert.loadingInviteTracking} />
        ) : (
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="overview" title={lang.current.inviteTracking.tabOverview}>
              {renderOverview()}
            </Tab>
            <Tab eventKey="details" title={lang.current.inviteTracking.tabDetails}>
              {renderDetails()}
            </Tab>
            <Tab eventKey="analytics" title={lang.current.inviteTracking.tabAnalytics}>
              {renderAnalytics()}
            </Tab>
          </Tabs>
        )}
      </div>
    </div>

    {/* User Invite Modal */}
    <UserInviteModal
      show={showInviteModal}
      onHide={() => setShowInviteModal(false)}
      onInviteCreated={(invite) => {
        // Add the new invite to the list and update stats
        setInvites(prev => [invite, ...prev]);
        setStats(prev => prev ? {
          ...prev,
          totalInvites: (prev.totalInvites || 0) + 1,
          activeInvites: (prev.activeInvites || 0) + 1
        } : prev);
      }}
    />

    {/* Deactivate Confirmation Modal */}
    <Modal
      show={showDeactivateModal}
      onClose={handleDeactivateCancel}
      title={lang.current.inviteTracking?.deactivateConfirmTitle || 'Deactivate Invite Code'}
      size="sm"
      footer={
        <div className={styles.deactivateModalFooter}>
          <Button
            variant="outline"
            onClick={handleDeactivateCancel}
            disabled={isDeactivating}
          >
            {lang.current.button?.cancel || 'Cancel'}
          </Button>
          <Button
            variant="danger"
            onClick={handleDeactivateConfirm}
            disabled={isDeactivating}
          >
            {isDeactivating
              ? (lang.current.inviteTracking?.deactivating || 'Deactivating...')
              : (lang.current.inviteTracking?.deactivate || 'Deactivate')
            }
          </Button>
        </div>
      }
    >
      <div className={styles.deactivateModalContent}>
        <p>
          {(lang.current.inviteTracking?.deactivateConfirmMessage || 'Are you sure you want to deactivate the invite code "{code}"? This action cannot be undone and the code will no longer be usable.')
            .replace('{code}', inviteToDeactivate?.code || '')}
        </p>
      </div>
    </Modal>
    </>
  );
}
