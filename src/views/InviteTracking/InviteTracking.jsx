/**
 * Invite Tracking View
 *
 * Displays invite codes created by the user and their usage statistics.
 * Shows who has redeemed invite codes and detailed analytics.
 *
 * Loading Pattern: Uses progressive loading to avoid code duplication.
 * Header content loads immediately, dynamic content loads after API call.
 */

import { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Tabs, Tab, Spinner } from 'react-bootstrap';
import { FaQrcode, FaCheckCircle, FaTimesCircle, FaClock, FaUsers, FaChartLine, FaEnvelope, FaMapMarkerAlt, FaCalendar } from 'react-icons/fa';
import { lang } from '../../lang.constants';
import { getMyInvites, getInviteDetails, getInviteAnalytics } from '../../utilities/invite-tracking-service';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import { getDefaultPhoto } from '../../utilities/photo-utils';
import Alert from '../../components/Alert/Alert';
import './InviteTracking.css';

export default function InviteTracking() {
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { error: showError } = useToast();

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
      setError('Failed to load invite codes. Please try again.');
      showError('Failed to load invite codes');
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
      showError('Failed to load invite details');
    }
  };

  const getStatusBadge = (invite) => {
    const now = new Date();
    const isExpired = invite.expiresAt && new Date(invite.expiresAt) < now;
    const isFullyUsed = invite.maxUses && invite.usedCount >= invite.maxUses;

    if (!invite.isActive) {
      return <Badge className="badge badge-secondary"><FaTimesCircle /> Inactive</Badge>;
    }
    if (isExpired) {
      return <Badge className="badge badge-danger"><FaClock /> Expired</Badge>;
    }
    if (isFullyUsed) {
      return <Badge className="badge badge-warning"><FaCheckCircle /> Fully Used</Badge>;
    }
    if (invite.usedCount > 0) {
      return <Badge className="badge badge-info"><FaUsers /> In Use</Badge>;
    }
    return <Badge className="badge badge-success"><FaCheckCircle /> Available</Badge>;
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
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
        <Row className="mb-4">
          <Col md={3} sm={6} className="mb-3">
            <Card className="stat-card">
              <Card.Body>
                <div className="stat-icon">
                  <FaQrcode />
                </div>
                <h2 className="stat-value">{stats.totalInvites}</h2>
                <p className="text-muted">Total Invites</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} sm={6} className="mb-3">
            <Card className="stat-card">
              <Card.Body>
                <div className="stat-icon text-success">
                  <FaCheckCircle />
                </div>
                <h2 className="stat-value">{stats.activeInvites}</h2>
                <p className="text-muted">Active</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} sm={6} className="mb-3">
            <Card className="stat-card">
              <Card.Body>
                <div className="stat-icon text-info">
                  <FaUsers />
                </div>
                <h2 className="stat-value">{stats.totalRedemptions}</h2>
                <p className="text-muted">Redemptions</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} sm={6} className="mb-3">
            <Card className="stat-card">
              <Card.Body>
                <div className="stat-icon text-danger">
                  <FaClock />
                </div>
                <h2 className="stat-value">{stats.expiredInvites}</h2>
                <p className="text-muted">Expired</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Invites Table */}
      <Card>
        <Card.Header>
          <h2><FaQrcode /> My Invite Codes</h2>
        </Card.Header>
        <Card.Body>
          {invites.length === 0 ? (
            <Alert type="info" message="You haven't created any invite codes yet." />
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Email</th>
                    <th>Used</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite._id}>
                      <td>
                        <code className="invite-code">{invite.code}</code>
                      </td>
                      <td>{getStatusBadge(invite)}</td>
                      <td>
                        {invite.email ? (
                          <span>
                            <FaEnvelope className="me-1" />
                            {invite.email}
                          </span>
                        ) : (
                          <span className="text-muted">Any</span>
                        )}
                      </td>
                      <td>
                        <Badge className="badge badge-secondary">
                          {invite.usedCount}/{invite.maxUses || '∞'}
                        </Badge>
                      </td>
                      <td>{formatDate(invite.createdAt)}</td>
                      <td>
                        {invite.expiresAt ? (
                          formatDate(invite.expiresAt)
                        ) : (
                          <span className="text-muted">Never</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => loadInviteDetails(invite.code)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );

  const renderDetails = () => {
    if (!selectedInvite) {
      return <Alert type="info" message="Select an invite code to view details." />;
    }

    return (
      <div>
        <button
          className="btn btn-outline-secondary mb-3"
          onClick={() => setActiveTab('overview')}
        >
          {lang.en.button.backToOverview}
        </button>

        <Row>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Header>
                <h6><FaQrcode /> Invite Code Details</h6>
              </Card.Header>
              <Card.Body>
                <div className="invite-detail-item">
                  <strong>Code:</strong>
                  <code className="invite-code-large">{selectedInvite.code}</code>
                </div>
                <div className="invite-detail-item">
                  <strong>Status:</strong>
                  {getStatusBadge(selectedInvite)}
                </div>
                <div className="invite-detail-item">
                  <strong>Usage:</strong>
                  <div>
                    <Badge className="badge badge-secondary">
                      {selectedInvite.usedCount}/{selectedInvite.maxUses || '∞'}
                    </Badge>
                    {selectedInvite.usagePercentage && (
                      <span className="ms-2 text-muted">
                        ({selectedInvite.usagePercentage}%)
                      </span>
                    )}
                  </div>
                </div>
                {selectedInvite.email && (
                  <div className="invite-detail-item">
                    <strong>Restricted to:</strong>
                    <div>
                      <FaEnvelope className="me-1" />
                      {selectedInvite.email}
                    </div>
                  </div>
                )}
                <div className="invite-detail-item">
                  <strong>Created:</strong>
                  <div>
                    <FaCalendar className="me-1" />
                    {formatDate(selectedInvite.createdAt)}
                  </div>
                </div>
                {selectedInvite.expiresAt && (
                  <div className="invite-detail-item">
                    <strong>Expires:</strong>
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
                  <h6><FaMapMarkerAlt /> Pre-configured Resources</h6>
                </Card.Header>
                <Card.Body>
                  {selectedInvite.experiences?.length > 0 && (
                    <div className="mb-3">
                      <strong>Experiences ({selectedInvite.experiences.length}):</strong>
                      <ul className="resource-list">
                        {selectedInvite.experiences.map((exp) => (
                          <li key={exp._id}>{exp.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedInvite.destinations?.length > 0 && (
                    <div>
                      <strong>Destinations ({selectedInvite.destinations.length}):</strong>
                      <ul className="resource-list">
                        {selectedInvite.destinations.map((dest) => (
                          <li key={dest._id}>
                            {dest.name}, {dest.country}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col md={8}>
            <Card>
              <Card.Header>
                <h6><FaUsers /> Redeemed By ({selectedInvite.redeemedBy?.length || 0})</h6>
              </Card.Header>
              <Card.Body>
                {!selectedInvite.redeemedBy || selectedInvite.redeemedBy.length === 0 ? (
                  <Alert type="info" message="No one has redeemed this invite code yet" />
                ) : (
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Email</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvite.redeemedBy.map((user) => {
                          const defaultPhoto = getDefaultPhoto(user);
                          const photoUrl = defaultPhoto?.url || user.oauthProfilePhoto;
                          
                          return (
                            <tr key={user._id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  {photoUrl && (
                                    <img
                                      src={photoUrl}
                                      alt={user.name}
                                      className="user-avatar-small me-2"
                                    />
                                  )}
                                  <span>{user.name}</span>
                                </div>
                              </td>
                              <td>{user.email}</td>
                              <td>{formatDate(user.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!analytics) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-3">Loading analytics...</p>
        </div>
      );
    }

    return (
      <div>
        <Row className="mb-4">
          <Col md={12}>
            <h2><FaChartLine /> Invite Analytics</h2>
          </Col>
        </Row>

        <Row>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Total Invites Created</h6>
                <div className="analytics-value">{analytics.totalInvites}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Total Redemptions</h6>
                <div className="analytics-value">{analytics.totalRedemptions}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Redemption Rate</h6>
                <div className="analytics-value">{analytics.redemptionRate}%</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Avg Redemptions/Invite</h6>
                <div className="analytics-value">{analytics.averageRedemptionsPerInvite}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Active Invites</h6>
                <div className="analytics-value">{analytics.activeInvites}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} sm={6} className="mb-3">
            <Card className="analytics-card">
              <Card.Body>
                <h6>Unused Invites</h6>
                <div className="analytics-value">{analytics.unusedInvites}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="mt-4">
          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h6>Recent Activity</h6>
              </Card.Header>
              <Card.Body>
                <div className="analytics-item">
                  <strong>Last 7 Days:</strong>
                  <span className="float-end">
                    <Badge className="badge badge-info">{analytics.redemptionsLast7Days} redemptions</Badge>
                    <Badge className="badge badge-secondary ms-2">
                      {analytics.invitesCreatedLast7Days} created
                    </Badge>
                  </span>
                </div>
                <div className="analytics-item">
                  <strong>Last 30 Days:</strong>
                  <span className="float-end">
                    <Badge className="badge badge-info">{analytics.redemptionsLast30Days} redemptions</Badge>
                    <Badge className="badge badge-secondary ms-2">
                      {analytics.invitesCreatedLast30Days} created
                    </Badge>
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h6>Invite Status Breakdown</h6>
              </Card.Header>
              <Card.Body>
                <div className="analytics-item">
                  <strong>Expired:</strong>
                  <Badge className="badge badge-danger float-end">{analytics.expiredInvites}</Badge>
                </div>
                <div className="analytics-item">
                  <strong>Fully Used:</strong>
                  <Badge className="badge badge-warning float-end">{analytics.fullyUsedInvites}</Badge>
                </div>
                <div className="analytics-item">
                  <strong>Email Restricted:</strong>
                  <Badge className="badge badge-secondary float-end">
                    {analytics.emailRestrictedInvites}
                  </Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="mt-3">
          <Col md={6} className="mb-3">
            <Card>
              <Card.Header>
                <h6>Pre-configured Resources</h6>
              </Card.Header>
              <Card.Body>
                <div className="analytics-item">
                  <strong>With Experiences:</strong>
                  <Badge className="badge badge-info float-end">
                    {analytics.invitesWithExperiences}
                  </Badge>
                </div>
                <div className="analytics-item">
                  <strong>With Destinations:</strong>
                  <Badge className="badge badge-success float-end">
                    {analytics.invitesWithDestinations}
                  </Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div className="profile-dropdown-view">
      <div className="container-fluid">
        <div className="view-header">
          <div className="row">
            <div className="col-12">
              <h1><FaQrcode /> Invite Tracking</h1>
              <p className="header-description">
                Track your invite codes and see who has joined using them
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert type="danger" message={error} dismissible onClose={() => setError(null)} />
        )}

        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Loading invite tracking data...</p>
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="overview" title="Overview">
              {renderOverview()}
            </Tab>
            <Tab eventKey="details" title="Invite Details">
              {renderDetails()}
            </Tab>
            <Tab eventKey="analytics" title="Analytics">
              {renderAnalytics()}
            </Tab>
          </Tabs>
        )}
      </div>
    </div>
  );
}
