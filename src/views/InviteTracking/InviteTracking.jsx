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
import { FaQrcode, FaCheckCircle, FaTimesCircle, FaClock, FaUsers, FaChartLine, FaEnvelope, FaMapMarkerAlt, FaCalendar, FaUserPlus } from 'react-icons/fa';
import { lang } from '../../lang.constants';
import { getMyInvites, getInviteDetails, getInviteAnalytics } from '../../utilities/invite-tracking-service';
import { eventBus } from '../../utilities/event-bus';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import { logger } from '../../utilities/logger';
import { getDefaultPhoto } from '../../utilities/photo-utils';
import { getFirstName } from '../../utilities/name-utils';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import Pagination from '../../components/Pagination/Pagination';
import PageOpenGraph from '../../components/OpenGraph/PageOpenGraph';
import UserInviteModal from '../../components/UserInviteModal/UserInviteModal';
import { Button, Container, FlexBetween, Table, TableHead, TableBody, TableRow, TableCell, SpaceY, Pill, EmptyState } from '../../components/design-system';
import styles from './InviteTracking.module.scss';

export default function InviteTracking() {
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { error: showError } = useToast();
  const { user } = useUser();

  // Get the first name suffix for personalized messages (e.g., ", John")
  const firstNameSuffix = user?.name ? `, ${getFirstName(user.name)}` : '';

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Compute paginated invites
  const paginatedInvites = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return invites.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [invites, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(invites.length / ITEMS_PER_PAGE);
  }, [invites.length]);

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
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        total: (prev.total || 0) + 1,
        pending: (prev.pending || 0) + 1
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
      // Update stats
      setStats(prev => prev ? {
        ...prev,
        redeemed: (prev.redeemed || 0) + 1,
        pending: Math.max(0, (prev.pending || 0) - 1)
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
          // Update stats based on deleted invite status
          setStats(s => s ? {
            ...s,
            total: Math.max(0, (s.total || 0) - 1),
            pending: deleted.usedCount === 0 ? Math.max(0, (s.pending || 0) - 1) : s.pending
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

  useEffect(() => {
    loadInvites();
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInvites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getMyInvites();
      setInvites(response.invites);
      setStats(response.stats);
      logger.info('Invites loaded successfully', {
        count: response.invites.length
      });
    } catch (err) {
      logger.error('Failed to load invites', {}, err);
      setError(lang.current.alert.failedToLoadInviteCodes);
      showError(lang.current.alert.failedToLoadInviteCodes);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await getInviteAnalytics();
      setAnalytics(data);
    } catch (err) {
      logger.error('Failed to load analytics', {}, err);
      // Don't show error for analytics - it's secondary data
    }
  };

  const loadInviteDetails = async (code) => {
    try {
      const details = await getInviteDetails(code);
      setSelectedInvite(details);
      setActiveTab('details');
    } catch (err) {
      logger.error('Failed to load invite details', { code }, err);
      showError(lang.current.alert.failedToLoadInviteDetails);
    }
  };

  const getStatusBadge = (invite) => {
    const now = new Date();
    const isExpired = invite.expiresAt && new Date(invite.expiresAt) < now;
    const isFullyUsed = invite.maxUses && invite.usedCount >= invite.maxUses;

    if (!invite.isActive) {
      return <Pill variant="secondary"><FaTimesCircle /> {lang.current.inviteTracking.inactive}</Pill>;
    }
    if (isExpired) {
      return <Pill variant="danger"><FaClock /> {lang.current.inviteTracking.expired}</Pill>;
    }
    if (isFullyUsed) {
      return <Pill variant="warning"><FaCheckCircle /> {lang.current.inviteTracking.fullyUsed}</Pill>;
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
        <Card.Header>
          <h2><FaQrcode /> {lang.current.inviteTracking.myInviteCodes}</h2>
        </Card.Header>
        <Card.Body className="p-0">
          {invites.length === 0 ? (
            <EmptyState
              variant="invites"
              title={lang.current.message.noInviteCodes.replace('{first_name_suffix}', firstNameSuffix)}
              description={lang.current.inviteTracking.noInviteCodesDescription}
              size="md"
              compact
            />
          ) : (
            <Table hover striped responsive>
              <TableHead>
                <TableRow>
                  <th>{lang.current.tableHeaders.code}</th>
                  <th>{lang.current.tableHeaders.status}</th>
                  <th>{lang.current.tableHeaders.email}</th>
                  <th>{lang.current.tableHeaders.used}</th>
                  <th>{lang.current.tableHeaders.created}</th>
                  <th>{lang.current.tableHeaders.expires}</th>
                  <th>{lang.current.tableHeaders.actions}</th>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedInvites.map((invite) => (
                  <TableRow key={invite._id}>
                    <TableCell>
                      <code className={styles.inviteCode}>{invite.code}</code>
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
                    <TableCell>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => loadInviteDetails(invite.code)}
                      >
                        {lang.current.button.viewDetails}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4 mb-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalResults={invites.length}
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
    </>
  );
}
