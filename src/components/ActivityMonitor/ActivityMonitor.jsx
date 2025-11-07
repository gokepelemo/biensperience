/**
 * ActivityMonitor Component
 * Super admin monitoring dashboard for Activity logs
 * Features: filtering, search, pagination, and rollback UI
 */

import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Table, Badge, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { FaSearch, FaFilter, FaUndo, FaEye, FaTimes } from 'react-icons/fa';
import Modal from '../Modal/Modal';
import Loading from '../Loading/Loading';
import Pagination from '../Pagination/Pagination';
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
      success('State restored successfully');
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
              <Table striped hover size="sm">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Resource</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity._id}>
                      <td>
                        <small>{formatDateTime(activity.timestamp)}</small>
                      </td>
                      <td>
                        <Badge className={`badge ${getActionBadgeVariant(activity.action)}`}>
                          {activity.action.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td>
                        <div>
                          <strong>{activity.actor.name}</strong>
                          <br />
                          <small className="text-muted">{activity.actor.email}</small>
                        </div>
                      </td>
                      <td>
                        <div>
                          <Badge className="badge badge-light text-dark">{activity.resource.type}</Badge>
                          <br />
                          <small>{activity.resource.name || 'Unnamed'}</small>
                        </div>
                      </td>
                      <td>
                        <small>{activity.reason}</small>
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
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
                    <tbody>
                      <tr>
                        <td><strong>Timestamp:</strong></td>
                        <td>{formatDateTime(selectedActivity.timestamp)}</td>
                      </tr>
                      <tr>
                        <td><strong>Action:</strong></td>
                        <td>
                          <Badge className={`badge ${getActionBadgeVariant(selectedActivity.action)}`}>
                            {selectedActivity.action.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Reason:</strong></td>
                        <td>{selectedActivity.reason}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>

                <div className="col-md-6">
                  <h6>Actor</h6>
                  <Table borderless size="sm">
                    <tbody>
                      <tr>
                        <td><strong>Name:</strong></td>
                        <td>{selectedActivity.actor.name}</td>
                      </tr>
                      <tr>
                        <td><strong>Email:</strong></td>
                        <td>{selectedActivity.actor.email}</td>
                      </tr>
                      <tr>
                        <td><strong>Role:</strong></td>
                        <td>{selectedActivity.actor.role}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>

                <div className="col-md-6">
                  <h6>Resource</h6>
                  <Table borderless size="sm">
                    <tbody>
                      <tr>
                        <td><strong>Type:</strong></td>
                        <td>{selectedActivity.resource.type}</td>
                      </tr>
                      <tr>
                        <td><strong>Name:</strong></td>
                        <td>{selectedActivity.resource.name || 'Unnamed'}</td>
                      </tr>
                      <tr>
                        <td><strong>ID:</strong></td>
                        <td><code>{selectedActivity.resource.id}</code></td>
                      </tr>
                    </tbody>
                  </Table>
                </div>

                {selectedActivity.metadata && (
                  <div className="col-12">
                    <h6>Request Metadata</h6>
                    <Table borderless size="sm">
                      <tbody>
                        {selectedActivity.metadata.ipAddress && (
                          <tr>
                            <td><strong>IP Address:</strong></td>
                            <td>{selectedActivity.metadata.ipAddress}</td>
                          </tr>
                        )}
                        {selectedActivity.metadata.userAgent && (
                          <tr>
                            <td><strong>User Agent:</strong></td>
                            <td><small>{selectedActivity.metadata.userAgent}</small></td>
                          </tr>
                        )}
                        {selectedActivity.metadata.requestPath && (
                          <tr>
                            <td><strong>Request Path:</strong></td>
                            <td>{selectedActivity.metadata.requestPath}</td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                )}

                {selectedActivity.changes && selectedActivity.changes.length > 0 && (
                  <div className="col-12">
                    <h6>Changes</h6>
                    <Table striped size="sm">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Old Value</th>
                          <th>New Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedActivity.changes.map((change, index) => (
                          <tr key={index}>
                            <td><code>{change.field}</code></td>
                            <td><code>{JSON.stringify(change.oldValue)}</code></td>
                            <td><code>{JSON.stringify(change.newValue)}</code></td>
                          </tr>
                        ))}
                      </tbody>
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