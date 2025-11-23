/**
 * ActivityMonitor Component
 * Super admin monitoring dashboard for Activity logs
 * Features: filtering, search, pagination, and rollback UI
 */

import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Badge, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { FaSearch, FaFilter, FaUndo, FaEye, FaTimes } from 'react-icons/fa';
import Modal from '../Modal/Modal';
import Loading from '../Loading/Loading';
import Pagination from '../Pagination/Pagination';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../../components/design-system';
import { getAllActivities, restoreResourceState } from '../../utilities/activities-api';
import { formatDateTime } from '../../utilities/date-utils';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';
import { useToast } from '../../contexts/ToastContext';
import './ActivityMonitor.css';

const ACTION_TYPES = [
  'permission_added', 'permission_removed', 'permission_updated', 'ownership_transferred',
  'resource_created', 'resource_updated', 'resource_deleted',
  'user_registered', 'user_updated', 'user_deleted', 'email_verified', 'password_changed', 'profile_updated',
  'plan_created', 'plan_updated', 'plan_deleted', 'plan_item_completed', 'plan_item_uncompleted',
  'favorite_added', 'favorite_removed', 'collaborator_added', 'collaborator_removed',
  'data_imported', 'data_exported', 'backup_created', 'rollback_performed'
];

const RESOURCE_TYPES = ['User', 'Experience', 'Destination', 'Photo', 'Plan', 'PlanItem'];

export default function ActivityMonitor({ show, onHide }) {
  const { success, error } = useToast();
  
  // State management
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
    actorId: '',
    resourceId: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    totalPages: 0,
    totalCount: 0
  });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const response = await getAllActivities(params);

      setActivities(response.activities || []);
      setPagination(prev => ({
        ...prev,
        totalPages: response.totalPages || 0,
        totalCount: response.totalCount || 0
      }));
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Fetch activities' });
      error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, searchTerm, error]);

  useEffect(() => {
    if (show) {
      fetchActivities();
    }
  }, [show, fetchActivities]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchActivities();
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      resourceType: '',
      startDate: '',
      endDate: '',
      actorId: '',
      resourceId: ''
    });
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const showActivityDetails = (activity) => {
    setSelectedActivity(activity);
    setShowDetails(true);
  };

  const handleRollback = async (activity) => {
    if (!activity.rollbackToken) {
      error('No rollback token available for this activity');
      return;
    }

    if (!window.confirm('Are you sure you want to rollback this change? This action cannot be undone.')) {
      return;
    }

    try {
      setRollbackLoading(true);
      await restoreResourceState(activity.rollbackToken);
      success(lang.en.notification?.admin?.stateRestored || 'Your previous state has been restored');
      fetchActivities();
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Rollback state' });
      error(errorMsg);
    } finally {
      setRollbackLoading(false);
    }
  };

  const getActionBadgeVariant = (action) => {
    if (action.includes('created')) return 'activity-badge-success';
    if (action.includes('deleted')) return 'activity-badge-danger';
    if (action.includes('updated')) return 'activity-badge-warning';
    if (action.includes('permission')) return 'activity-badge-info';
    return 'activity-badge-secondary';
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted">
          Showing {activities.length} of {pagination.totalCount} activities
        </div>
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          variant="text"
          totalResults={pagination.totalCount}
          resultsPerPage={pagination.limit}
        />
      </div>
    );
  };

  return (
    <>
      <Modal 
        show={show} 
        onClose={onHide} 
        title={
          <>
            <FaEye className="me-2" />
            Activity Monitor
            <Badge className="badge badge-secondary activity-monitor-badge">Super Admin</Badge>
          </>
        }
        size="xl"
        scrollable={true}
        showSubmitButton={false}
        showCancelButton={false}
        contentClassName="modal-gradient-header"
        footer={
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        }
      >
        <div className="activity-monitor">
          {/* Search and Filters */}
          <div className="filters-section mb-4">
            <Form onSubmit={handleSearch}>
              <div className="row align-items-end">
                {/* Search */}
                <div className="col-lg-3 col-md-6">
                  <Form.Label>Search</Form.Label>
                  <InputGroup style={{
                    border: 'var(--form-field-border)',
                    borderRadius: 'var(--form-field-border-radius)',
                    overflow: 'var(--form-field-overflow)',
                    minHeight: 'var(--form-field-min-height)',
                  }}>
                    <Form.Control
                      type="text"
                      placeholder={lang.en.placeholder.searchActivities}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        backgroundColor: 'var(--form-field-control-bg)',
                        border: 'var(--form-field-control-border)',
                        color: 'var(--form-field-control-color)',
                        fontSize: 'var(--form-field-control-font-size)',
                        padding: 'var(--form-field-control-padding)',
                        minHeight: 'var(--form-field-control-min-height)',
                        outline: 'var(--form-field-control-outline)',
                        boxShadow: 'var(--form-field-control-box-shadow)',
                        borderRadius: '0',
                      }}
                    />
                    <Button variant="outline-secondary" type="submit" disabled={loading} style={{
                      backgroundColor: 'var(--form-field-addon-bg)',
                      border: 'var(--form-field-addon-border)',
                      color: 'var(--form-field-addon-color)',
                      minHeight: 'var(--form-field-addon-min-height)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <FaSearch />
                    </Button>
                  </InputGroup>
                </div>

                {/* Action Filter */}
                <div className="col-lg-2 col-md-6">
                  <Form.Label>Action</Form.Label>
                  <Form.Select
                    value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                  >
                    <option value="">All Actions</option>
                    {ACTION_TYPES.map(action => (
                      <option key={action} value={action}>
                        {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                {/* Resource Type Filter */}
                <div className="col-lg-2 col-md-6">
                  <Form.Label>Resource</Form.Label>
                  <Form.Select
                    value={filters.resourceType}
                    onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  >
                    <option value="">All Resources</option>
                    {RESOURCE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Form.Select>
                </div>

                {/* Date Range */}
                <div className="col-lg-2 col-md-6">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    style={{
                      backgroundColor: 'var(--form-field-control-bg)',
                      border: 'var(--form-field-border)',
                      color: 'var(--form-field-control-color)',
                      fontSize: 'var(--form-field-control-font-size)',
                      padding: 'var(--form-field-control-padding)',
                      minHeight: 'var(--form-field-min-height)',
                      outline: 'var(--form-field-control-outline)',
                      boxShadow: 'var(--form-field-control-box-shadow)',
                      borderRadius: 'var(--form-field-border-radius)',
                    }}
                  />
                </div>
                <div className="col-lg-2 col-md-6">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    style={{
                      backgroundColor: 'var(--form-field-control-bg)',
                      border: 'var(--form-field-border)',
                      color: 'var(--form-field-control-color)',
                      fontSize: 'var(--form-field-control-font-size)',
                      padding: 'var(--form-field-control-padding)',
                      minHeight: 'var(--form-field-min-height)',
                      outline: 'var(--form-field-control-outline)',
                      boxShadow: 'var(--form-field-control-box-shadow)',
                      borderRadius: 'var(--form-field-border-radius)',
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="col-12">
                  <div className="filter-actions d-flex justify-center-mobile-tablet">
                    <Button variant="primary" type="submit" disabled={loading}>
                      <FaFilter className="me-1" />
                      Apply Filters
                    </Button>
                    <Button variant="outline-secondary" onClick={clearFilters} disabled={loading}>
                      <FaTimes className="me-1" />
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </Form>
          </div>

          {/* Activities Table */}
          <div className="table-responsive">
            {loading ? (
              <Loading variant="centered" size="md" message="Loading activities..." />
            ) : activities.length === 0 ? (
              <Alert variant="info">
                No activities found with the current filters.
              </Alert>
            ) : (
              <Table hover striped responsive>
                <TableHead>
                  <TableRow>
                    <TableCell as="th">Timestamp</TableCell>
                    <TableCell as="th">Action</TableCell>
                    <TableCell as="th">Actor</TableCell>
                    <TableCell as="th">Resource</TableCell>
                    <TableCell as="th">Reason</TableCell>
                    <TableCell as="th">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow key={activity._id}>
                      <TableCell>
                        <small>{formatDateTime(activity.timestamp)}</small>
                      </TableCell>
                      <TableCell>
                        <Badge className={`badge ${getActionBadgeVariant(activity.action)}`}>
                          {activity.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <strong>{activity.actor.name}</strong>
                          <br />
                          <small className="text-muted">{activity.actor.email}</small>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge className="badge badge-surface text-color-primary">{activity.resource.type}</Badge>
                          <br />
                          <small>{activity.resource.name || 'Unnamed'}</small>
                        </div>
                      </TableCell>
                      <TableCell>
                        <small>{activity.reason}</small>
                      </TableCell>
                      <TableCell>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => showActivityDetails(activity)}
                          >
                            <FaEye />
                          </Button>
                          {activity.rollbackToken && (
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={() => handleRollback(activity)}
                              disabled={rollbackLoading}
                            >
                              <FaUndo />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {renderPagination()}
        </div>
      </Modal>

      {/* Activity Details Modal */}
      <Modal
        show={showDetails && selectedActivity}
        onClose={() => {
          setShowDetails(false);
          setSelectedActivity(null);
        }}
        title={lang.en.modal.activityDetails}
        size="lg"
        showSubmitButton={false}
        showCancelButton={false}
        footer={
          <Button variant="secondary" onClick={() => {
            setShowDetails(false);
            setSelectedActivity(null);
          }}>
            Close
          </Button>
        }
      >
          {selectedActivity && (
            <div className="activity-details">
              <div className="row g-3">
                <div className="col-12">
                  <h6>Basic Information</h6>
                  <Table borderless size="sm">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Timestamp:</strong></TableCell>
                        <TableCell>{formatDateTime(selectedActivity.timestamp)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Action:</strong></TableCell>
                        <TableCell>
                          <Badge className={`badge ${getActionBadgeVariant(selectedActivity.action)}`}>
                            {selectedActivity.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Reason:</strong></TableCell>
                        <TableCell>{selectedActivity.reason}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="col-md-6">
                  <h6>Actor</h6>
                  <Table borderless size="sm">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Name:</strong></TableCell>
                        <TableCell>{selectedActivity.actor.name}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Email:</strong></TableCell>
                        <TableCell>{selectedActivity.actor.email}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Role:</strong></TableCell>
                        <TableCell>{selectedActivity.actor.role}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="col-md-6">
                  <h6>Resource</h6>
                  <Table borderless size="sm">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Type:</strong></TableCell>
                        <TableCell>{selectedActivity.resource.type}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Name:</strong></TableCell>
                        <TableCell>{selectedActivity.resource.name || 'Unnamed'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>ID:</strong></TableCell>
                        <TableCell><code>{selectedActivity.resource.id}</code></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {selectedActivity.metadata && (
                  <div className="col-12">
                    <h6>Request Metadata</h6>
                    <Table borderless size="sm">
                      <TableBody>
                        {selectedActivity.metadata.ipAddress && (
                          <TableRow>
                            <TableCell><strong>IP Address:</strong></TableCell>
                            <TableCell>{selectedActivity.metadata.ipAddress}</TableCell>
                          </TableRow>
                        )}
                        {selectedActivity.metadata.userAgent && (
                          <TableRow>
                            <TableCell><strong>User Agent:</strong></TableCell>
                            <TableCell><small>{selectedActivity.metadata.userAgent}</small></TableCell>
                          </TableRow>
                        )}
                        {selectedActivity.metadata.requestPath && (
                          <TableRow>
                            <TableCell><strong>Request Path:</strong></TableCell>
                            <TableCell>{selectedActivity.metadata.requestPath}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selectedActivity.changes && selectedActivity.changes.length > 0 && (
                  <div className="col-12">
                    <h6>Changes</h6>
                    <Table striped size="sm">
                      <TableHead>
                        <TableRow>
                          <TableCell as="th">Field</TableCell>
                          <TableCell as="th">Old Value</TableCell>
                          <TableCell as="th">New Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedActivity.changes.map((change, index) => (
                          <TableRow key={index}>
                            <TableCell><code>{change.field}</code></TableCell>
                            <TableCell><code>{JSON.stringify(change.oldValue)}</code></TableCell>
                            <TableCell><code>{JSON.stringify(change.newValue)}</code></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {selectedActivity.rollbackToken && (
                  <div className="col-12">
                    <Alert variant="info">
                      <strong>Rollback Available:</strong> This activity has a rollback token and can be reverted.
                      <br />
                      <Button 
                        variant="warning" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleRollback(selectedActivity)}
                        disabled={rollbackLoading}
                      >
                        <FaUndo className="me-1" />
                        Rollback This Change
                      </Button>
                    </Alert>
                  </div>
                )}
              </div>
            </div>
          )}
      </Modal>
    </>
  );
}